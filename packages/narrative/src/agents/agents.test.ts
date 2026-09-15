import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import type { GameState, ModelContext, Option } from '@ag/schemas';
import type { BeatContextInput } from '../beat-generator.js';
import { CharacterAgent } from './character-agent.js';
import { PlayerAgent } from './player-agent.js';
import { auditOutput } from './types.js';

const beatInput: BeatContextInput = {
  npcName: '阿尔托莉雅',
  npcId: 'char_saber',
  retrievedMemories: [],
  timeChange: { previous: '09:30', current: '10:00', crossedDayBoundary: false },
  locationChange: { fromLocationId: 'loc_canteen', toLocationId: 'loc_canteen' },
  flow: { beatsUsed: 1, choicesUsed: 0, beatSummaries: ['玩家选择了陪伴用餐'] },
};

describe('PlayerAgent', () => {
  const agent = new PlayerAgent();

  it('契约：role/管辖权/默认 systemRules 注入', () => {
    expect(agent.role).toBe('player');
    expect(agent.viewContract.jurisdiction).toContain('玩家 Agent');
    const rules = agent.buildSystemRules();
    expect(rules).toContain('你是叙事系统');
    expect(rules).toContain('【Agent 管辖权（player）】');
    expect(rules).toContain('第一人称「我」');
  });

  it('buildSystemRules 保留引擎基础规则并追加契约', () => {
    const rules = agent.buildSystemRules('【基础规则】世界连续性。');
    expect(rules.startsWith('【基础规则】世界连续性。')).toBe(true);
    expect(rules).toContain('【Agent 管辖权（player）】');
  });

  it('generateChoiceBeat：契约进入 system 消息（非法响应走 fallback 不阻断）', async () => {
    let capturedSystem = '';
    const provider = new TestProvider((request) => {
      capturedSystem = request.messages[0]?.content ?? '';
      return { text: 'not-json' };
    });
    const result = await agent.generateChoiceBeat(beatInput, provider);
    expect(capturedSystem).toContain('【Agent 管辖权（player）】');
    expect(result.source).toBe('fallback');
  });

  it('validateOutput：空选项/空场景记违规', () => {
    expect(agent.validateOutput({ options: [] }).ok).toBe(false);
    expect(agent.validateOutput({ scenario: { narrative: '' } }).ok).toBe(false);
    expect(agent.validateOutput({ options: [{}], scenario: { narrative: 'x' } }).ok).toBe(true);
  });

  it('auditOutput：违规时回调携带 role', () => {
    const seen: Array<{ role: string; violations: readonly string[] }> = [];
    auditOutput(agent, { options: [] }, (role, violations) => seen.push({ role, violations }));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.role).toBe('player');
  });
});

describe('CharacterAgent', () => {
  const agent = new CharacterAgent();

  it('契约：role/管辖权/默认 systemRules 注入', () => {
    expect(agent.role).toBe('character');
    expect(agent.viewContract.jurisdiction).toContain('角色 Agent');
    const rules = agent.buildSystemRules();
    expect(rules).toContain('你是叙事旁白系统');
    expect(rules).toContain('【Agent 管辖权（character）】');
    expect(rules).toContain('motive');
  });

  it('generateNarrativeBeats：契约进入 system 消息，生成器层视角契约保留在 user 消息（纵深防御）', async () => {
    let captured: { system: string; user: string } = { system: '', user: '' };
    const provider = new TestProvider((request) => {
      captured = {
        system: request.messages[0]?.content ?? '',
        user: request.messages[1]?.content ?? '',
      };
      return { text: 'not-json' };
    });
    const beats = await agent.generateNarrativeBeats(beatInput, provider);
    expect(captured.system).toContain('【Agent 管辖权（character）】');
    expect(captured.user).toContain('【视角契约（角色 Agent）】');
    expect(captured.user).toContain('禁止描写玩家未做出的任何新行动');
    expect(beats).toHaveLength(1);
    expect(beats[0]!.source).toBe('fallback');
  });

  it('generateReaction：契约注入 context.systemRules（非法响应走 fallback）', async () => {
    let capturedSystem = '';
    const provider = new TestProvider((request) => {
      capturedSystem = request.messages[0]?.content ?? '';
      return { text: 'not-json' };
    });
    const context = {
      systemRules: 'BASE',
      retrievedMemories: [],
      currentEvent: undefined,
      recentEvents: [],
      currentState: { characters: {} },
    } as unknown as ModelContext;
    const state = { characters: {} } as unknown as GameState;
    const option = {
      behavior: { actions: ['chat'], intent: ['connect'], risk: 0.1 },
    } as unknown as Option;
    const reaction = await agent.generateReaction(context, state, option, provider);
    expect(capturedSystem).toContain('BASE');
    expect(capturedSystem).toContain('【Agent 管辖权（character）】');
    expect(reaction.source).toBe('fallback');
  });

  it('validateOutput：文段拍缺 narration / 预支 options 记违规', () => {
    const result = agent.validateOutput([
      { narration: '' },
      { narration: 'ok', options: [{ id: 'x' }] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('narration'))).toBe(true);
    expect(result.violations.some((v) => v.includes('options'))).toBe(true);
  });

  it('validateOutput：反应空 narrative 记违规；过渡空 narration 记违规', () => {
    expect(agent.validateOutput({ narrative: '' }).ok).toBe(false);
    expect(agent.validateOutput({ narration: '' }).ok).toBe(false);
    expect(agent.validateOutput({ narrative: '她说……', structured: {} }).ok).toBe(true);
  });
});
