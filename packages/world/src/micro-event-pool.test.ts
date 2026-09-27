import { describe, expect, it } from 'vitest';
import { XorShift128Rng } from './rng-service.js';
import { makeWorldGameState } from './test-data.js';
import { MicroEventPool, BUILTIN_MICRO_TEMPLATES } from './micro-event-pool.js';

describe('MicroEventPool（P3 S2）', () => {
  const state = makeWorldGameState();

  it('概率门 = 1 时必产出：definition 合法（importance=micro）、旁白第一人称、实例字段完整', () => {
    const pool = new MicroEventPool();
    const selection = pool.trySelect({
      state,
      rng: new XorShift128Rng(20260927),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 1,
    });
    expect(selection).toBeDefined();
    expect(selection!.definition.importance).toBe('micro');
    expect(selection!.definition.eventId).toMatch(/^event_micro_/);
    expect(selection!.definition.eventId).toContain(selection!.templateId);
    expect(selection!.narration).toContain('我');
    expect(selection!.narration).not.toContain('她想起');
    expect(selection!.instance.eventId).toBe(selection!.definition.eventId);
    expect(selection!.instance.status).toBe('active');
    expect(selection!.instance.origin).toBe('pool');
    expect(selection!.memoryContent.length).toBeGreaterThan(0);
  });

  it('概率门 = 0 时不产出', () => {
    const pool = new MicroEventPool();
    const selection = pool.trySelect({
      state,
      rng: new XorShift128Rng(1),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 0,
    });
    expect(selection).toBeUndefined();
  });

  it('excludeTemplateIds 排除近期模板', () => {
    const pool = new MicroEventPool();
    const exclude = BUILTIN_MICRO_TEMPLATES.map((template) => template.templateId);
    // 全部排除 → 无可用模板
    const none = pool.trySelect({
      state,
      rng: new XorShift128Rng(7),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 1,
      excludeTemplateIds: exclude,
    });
    expect(none).toBeUndefined();
    // 排除其余、仅留 afternoon 模板 + 上午时间 → matches 不过
    const morning = pool.trySelect({
      state,
      rng: new XorShift128Rng(7),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 1,
      excludeTemplateIds: exclude.filter((id) => id !== 'environment_light'),
    });
    // makeWorldGameState 时间若为上午则 environment_light 被 matches 过滤
    if (state.run.time < '14:00') {
      expect(morning).toBeUndefined();
    } else {
      expect(morning?.templateId).toBe('environment_light');
    }
  });

  it('同种子确定性：两次选择结果一致', () => {
    const pool = new MicroEventPool();
    const a = pool.trySelect({
      state,
      rng: new XorShift128Rng(42),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 1,
    });
    const b = pool.trySelect({
      state,
      rng: new XorShift128Rng(42),
      characterId: 'char_saber',
      characterName: '阿尔托莉雅',
      probability: 1,
    });
    expect(a?.templateId).toBe(b?.templateId);
    expect(a?.instance.instanceId).toBe(b?.instance.instanceId);
  });

  it('八类内置模板齐全（5 类别 × 1–2 变体）', () => {
    const categories = new Set(BUILTIN_MICRO_TEMPLATES.map((template) => template.category));
    expect(categories).toEqual(
      new Set(['encounter', 'one_liner', 'brief_interaction', 'environment', 'solo']),
    );
  });
});
