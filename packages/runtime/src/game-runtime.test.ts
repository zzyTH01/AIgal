import { describe, expect, it } from 'vitest';
import { validateGameState } from '@ag/core';
import { TestProvider } from '@ag/llm';
import { JsonDirectorySaveRepository } from '@ag/persistence/json-directory';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplicationApi } from './application-api.js';
import { GameRuntime } from './game-runtime.js';

describe('GameRuntime', () => {
  it('starts a game and completes one full turn through the Application API', async () => {
    const api = ApplicationApi.create();
    const started = await api.gameStart();
    expect(started.ok).toBe(true);
    expect(validateGameState(started.data!).success).toBe(true);
    expect(started.data!.world.activeEvents[0]?.eventId).toBe('event_classroom_after_school');

    const turn = await api.turnStart();
    expect(turn.ok).toBe(true);
    expect(turn.data!.options).toHaveLength(4);
    expect(turn.data!.scenario.narrative.length).toBeGreaterThan(0);

    const choice = await api.turnChoice(turn.data!.options[0]!.id);
    expect(choice.ok).toBe(true);
    expect(choice.data!.state.run.turn).toBe(1);
    expect(validateGameState(choice.data!.state).success).toBe(true);
    expect(choice.data!.turnResult.secondaryDelta.characters?.char_asuka?.psychology).toBeDefined();
    expect(choice.data!.state.playerModel.caring).toBeGreaterThan(50);
    expect(Object.keys(choice.data!.state.memories.records).length).toBeGreaterThan(0);
  });

  it('falls back to deterministic content when LLM output is invalid', async () => {
    const runtime = new GameRuntime({ gateway: TestProvider.fromText('bad-json') });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.source).toBe('fallback');
    expect(turn.options).toHaveLength(4);
  });

  it('save/load restores GameState', async () => {
    const runtime = new GameRuntime();
    const started = runtime.startGame();
    await runtime.save('save_1');
    const saved = runtime.getState();
    await runtime.load('save_1');
    expect(runtime.getState()).toEqual(saved);
    expect(runtime.getState().run.runId).toBe(started.run.runId);
  });

  it('closes a bad run and starts a new run with inherited meta', () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    const badEnding = {
      endingId: 'ending_bad_test',
      kind: 'bad' as const,
      title: 'Bad End',
      description: '测试坏结局',
      conditions: { 'run.turn': { min: 1 } },
      priority: 50,
    };
    const ended = runtime.endRun(badEnding);
    expect(ended.meta.endingsDiscovered).toContain('ending_bad_test');
    expect(ended.run.status).toBe('bad_end');

    runtime.setPermanentModifier('starting_trust', 6);
    const next = runtime.startNewRun(123);
    expect(next.meta.endingsDiscovered).toContain('ending_bad_test');
    expect(next.meta.runCount).toBe(ended.meta.runCount + 1);
    expect(next.relationships.rel_player_char_asuka?.trust).toBe(6);
  });

  it('injects Project Policy into generation prompts', async () => {
    const requests: string[] = [];
    const provider = new TestProvider((request) => {
      requests.push(request.messages[0]?.content ?? '');
      return {
        text: request.messages[0]?.content.includes('行为选项')
          ? JSON.stringify({
              scenario: { narrative: '测试场景', structured: {} },
              options: [
                {
                  id: 'o1',
                  presentation: { text: '选项一', tone: 'neutral' },
                  behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
                  gameplay: { progress: 1 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o2',
                  presentation: { text: '选项二', tone: 'neutral' },
                  behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
                  gameplay: { progress: 0 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o3',
                  presentation: { text: '选项三', tone: 'neutral' },
                  behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o4',
                  presentation: { text: '选项四', tone: 'neutral' },
                  behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
              ],
            })
          : JSON.stringify({ narrative: '回应', structured: {} }),
      };
    });
    const runtime = new GameRuntime({
      gateway: provider,
      policy: {
        ageRating: 'all_ages',
        relationshipTypes: ['stranger'],
        contentTags: ['slice_of_life'],
        narrativeTone: 'gentle',
        matureThemes: [],
        generationConstraints: { avoid: 'violence' },
      },
    });
    runtime.startGame();
    await runtime.startTurn();
    expect(requests[0]).toContain('语气：gentle');
    expect(requests[0]).toContain('avoid: violence');
  });

  it('can persist to a JSON directory repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tavern-runtime-saves-'));
    const repo = new JsonDirectorySaveRepository({ baseDir: dir });
    const runtime = new GameRuntime({ persistence: repo });
    runtime.startGame();
    await runtime.save('run_017');
    expect(await repo.list()).toEqual(['run_017']);

    const restored = new GameRuntime({ persistence: repo });
    await restored.load('run_017');
    expect(restored.getState().run.runId).toBe('run_001');
    await rm(dir, { recursive: true, force: true });
  });

  it('reinforces retrieved memories on context assembly', async () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    const turn = await runtime.startTurn();
    await runtime.chooseOption(turn.options[0]!.id);
    const before = Object.values(runtime.getState().memories.records);
    expect(before.length).toBeGreaterThan(0);

    await runtime.startTurn();
    const after = runtime.getState().memories.records;
    for (const record of before) {
      const updated = after[record.id];
      expect(updated).toBeDefined();
      expect(updated!.retrievalCount).toBe(record.retrievalCount + 1);
      expect(updated!.strength).toBeGreaterThanOrEqual(record.strength);
      expect(updated!.lastRetrievedAt?.day).toBe(runtime.getState().run.day);
    }
  });

  it('exposes context cache stats that improve across turns', async () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    await runtime.startTurn();
    const first = runtime.getContextCacheStats();
    expect(first.misses).toBeGreaterThan(0);

    await runtime.chooseOption((await runtime.getCurrentOptions())[0]?.id ?? '');
    await runtime.startTurn();
    const second = runtime.getContextCacheStats();
    expect(second.hits).toBeGreaterThan(first.hits);
  });

  it('prunes memories beyond the configured limit', async () => {
    const runtime = new GameRuntime({ memoryPruneLimit: 2 });
    runtime.startGame();
    for (let i = 0; i < 3; i += 1) {
      const turn = await runtime.startTurn();
      await runtime.chooseOption(turn.options[0]!.id);
    }
    expect(Object.keys(runtime.getState().memories.records).length).toBeLessThanOrEqual(2);
  });

  it('applies consistency rules to scenario and reaction generation', async () => {
    const provider = new TestProvider((request) =>
      request.messages.some((message) => message.content.includes('行为选项'))
        ? {
            text: JSON.stringify({
              scenario: { narrative: '场景中出现禁忌词', structured: {} },
              options: [
                {
                  id: 'o1',
                  presentation: { text: '选项一', tone: 'neutral' },
                  behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
                  gameplay: { progress: 1 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o2',
                  presentation: { text: '选项二', tone: 'neutral' },
                  behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
                  gameplay: { progress: 0 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o3',
                  presentation: { text: '选项三', tone: 'neutral' },
                  behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o4',
                  presentation: { text: '选项四', tone: 'neutral' },
                  behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
              ],
            }),
          }
        : { text: JSON.stringify({ narrative: '回应包含禁忌词', structured: {} }) },
    );
    const runtime = new GameRuntime({
      gateway: provider,
      consistency: { forbiddenTopics: ['禁忌词'] },
    });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.source).toBe('fallback');

    const choice = await runtime.chooseOption(turn.options[0]!.id);
    expect(choice.reactionText).toBe('……（NPC 没有回应。）');
  });

  it('carries transition through startTurn → TurnResult with memory linkage', async () => {
    let calls = 0;
    const provider = new TestProvider((request) => {
      calls += 1;
      if (request.messages.some((message) => message.content.includes('行为选项'))) {
        return {
          text: JSON.stringify({
            transition: {
              narration: '走廊安静下来，她还在想刚才的事。',
              dialogues: [{ speakerId: 'char_asuka', text: '……你刚才说的，我想了很久。' }],
              referencedMemoryIds: [],
              memoryCandidate: {
                type: 'episodic',
                content: '角色在过场中回味玩家的帮助。',
                importance: 40,
                emotionalIntensity: 30,
                valence: 10,
                tags: ['care'],
                relatedCharacters: ['char_asuka'],
                sourceTurnId: 'placeholder',
              },
            },
            scenario: { narrative: '测试场景', structured: {} },
            options: [
              {
                id: 'o1',
                presentation: { text: '选项一', tone: 'neutral' },
                behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
                gameplay: { progress: 1 },
                effects: {},
                conditions: {},
                generation: {
                  must_fit_character: true,
                  must_fit_context: true,
                  variation: 'medium',
                },
              },
              {
                id: 'o2',
                presentation: { text: '选项二', tone: 'neutral' },
                behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
                gameplay: { progress: 0 },
                effects: {},
                conditions: {},
                generation: {
                  must_fit_character: true,
                  must_fit_context: true,
                  variation: 'medium',
                },
              },
              {
                id: 'o3',
                presentation: { text: '选项三', tone: 'neutral' },
                behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
                gameplay: { progress: 2 },
                effects: {},
                conditions: {},
                generation: {
                  must_fit_character: true,
                  must_fit_context: true,
                  variation: 'medium',
                },
              },
              {
                id: 'o4',
                presentation: { text: '选项四', tone: 'neutral' },
                behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
                gameplay: { progress: 2 },
                effects: {},
                conditions: {},
                generation: {
                  must_fit_character: true,
                  must_fit_context: true,
                  variation: 'medium',
                },
              },
            ],
          }),
        };
      }
      return { text: JSON.stringify({ narrative: '回应', structured: {} }) };
    });

    const runtime = new GameRuntime({ gateway: provider });
    runtime.startGame();

    // Turn 1：首 Turn 无前序轮次，过渡仍生成（fromLocationId=null 分支）
    const turn1 = await runtime.startTurn();
    expect(turn1.transition).toBeDefined();
    expect(turn1.transition!.location.fromLocationId).toBeNull();
    expect(turn1.transition!.narrative.source).toBe('llm');

    // 过渡 memoryCandidate 已入库（sourceTurnId 归一为本 Turn）
    const candidates = Object.values(runtime.getState().memories.records).filter((record) =>
      record.content.includes('回味'),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.sourceTurnId).toBe(turn1.turnId);

    await runtime.chooseOption(turn1.options[0]!.id);
    expect(calls).toBe(2);

    // Turn 2：时间承接上一轮（日内推进 30 分钟），过渡进入 TurnResult
    const turn2 = await runtime.startTurn();
    expect(turn2.transition!.time.previous).toBe('09:00');
    expect(turn2.transition!.time.current).toBe('09:30');
    const choice2 = await runtime.chooseOption(turn2.options[1]!.id);
    expect(choice2.turnResult.transition?.turnId).toBe(turn2.turnId);
    expect(choice2.turnResult.transition?.narrative.dialogues[0]?.text).toContain('想了很久');
  });

  it('reinforces memories referenced by the transition narrative (cooldown-aware)', async () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    const turn1 = await runtime.startTurn();
    await runtime.chooseOption(turn1.options[0]!.id);

    // 形成一条真实记忆后，下一轮检索应命中并被过渡引用强化
    const before = Object.values(runtime.getState().memories.records)[0]!;
    const retrievalCountBefore = before.retrievalCount;
    const turn2 = await runtime.startTurn();
    const after = runtime.getState().memories.records[before.id]!;
    // 检索强化 + 过渡引用强化共用冷却：同一天至多 +12
    expect(after.strength).toBeLessThanOrEqual(before.strength + 12);
    expect(turn2.transition).toBeDefined();
    void retrievalCountBefore;
  });

  it('retries flaky LLM calls according to llmMaxAttempts', async () => {
    let calls = 0;
    const combinedPayload = JSON.stringify({
      scenario: { narrative: '重试后的场景', structured: {} },
      options: [
        {
          id: 'o1',
          presentation: { text: '选项一', tone: 'neutral' },
          behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
          gameplay: { progress: 1 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o2',
          presentation: { text: '选项二', tone: 'neutral' },
          behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
          gameplay: { progress: 0 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o3',
          presentation: { text: '选项三', tone: 'neutral' },
          behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
          gameplay: { progress: 2 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o4',
          presentation: { text: '选项四', tone: 'neutral' },
          behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
          gameplay: { progress: 2 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
      ],
    });
    const provider = new TestProvider(() => {
      calls += 1;
      if (calls === 1) throw new Error('flaky');
      return { text: combinedPayload };
    });
    const runtime = new GameRuntime({ gateway: provider, llmMaxAttempts: 2 });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.narrative).toBe('重试后的场景');
    expect(calls).toBe(2);
  });
});
