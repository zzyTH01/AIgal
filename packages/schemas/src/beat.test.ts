import { describe, expect, it } from 'vitest';
import {
  beatSchema,
  choiceBeatSchema,
  eventDefinitionSchema,
  eventFlowSchema,
  narrativeBeatSchema,
} from './index.js';

const baseOption = {
  id: 'option_001',
  presentation: { text: '选项文本', tone: 'neutral' },
  behavior: { actions: ['chat'], intent: ['connect'], risk: 0.1 },
  gameplay: { progress: 1 },
  effects: {},
  conditions: {},
  generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
};

describe('Beat contracts', () => {
  it('parses a narrative beat with defaults', () => {
    const beat = narrativeBeatSchema.parse({
      beatId: 'beat_001',
      kind: 'narrative',
      narration: '走廊安静下来。',
      dialogues: [{ speakerId: 'char_x', text: '……还在想刚才的事。' }],
      source: 'llm',
    });
    expect(beat.branchPotential).toBe('mid');
    expect(beat.emotionDrift).toBeUndefined();
  });

  it('enforces narrative/choice mutual exclusivity via discriminated union', () => {
    const narrative = beatSchema.parse({
      beatId: 'beat_002',
      kind: 'narrative',
      narration: '文段。',
      dialogues: [],
      source: 'fallback',
    });
    expect(narrative.kind).toBe('narrative');

    const choice = choiceBeatSchema.parse({
      beatId: 'beat_003',
      kind: 'choice',
      options: [baseOption, { ...baseOption, id: 'option_002' }],
      source: 'llm',
    });
    expect(choice.options).toHaveLength(2);
    // 契约互斥：choice 分支没有 narration 字段，narrative 分支没有 options 字段
    expect('narration' in choice).toBe(false);
    expect('options' in narrative).toBe(false);
  });

  it('rejects choice beat with long intro and missing option fields', () => {
    expect(
      choiceBeatSchema.safeParse({
        beatId: 'b',
        kind: 'choice',
        intro: 'x'.repeat(200),
        options: [baseOption, baseOption],
        source: 'llm',
      }).success,
    ).toBe(false);
    expect(
      choiceBeatSchema.safeParse({
        beatId: 'b2',
        kind: 'choice',
        options: [{ ...baseOption }, {}],
        source: 'llm',
      }).success,
    ).toBe(false);
  });

  it('event flow defaults importance to side and tracks budget fields', () => {
    const flow = eventFlowSchema.parse({
      eventId: 'event_library',
      beatsUsed: 0,
      maxBeats: 6,
      choicesUsed: 0,
      maxChoices: 2,
      beatsSinceLastChoice: 0,
      status: 'flowing',
      beatSummaries: [],
    });
    expect(flow.importance).toBe('side');
  });

  it('event definition gains optional importance with side default', () => {
    const withoutImportance = eventDefinitionSchema.parse({
      eventId: 'event_a',
      type: 'daily',
      rarity: 'common',
      title: 't',
      description: 'd',
      baseWeight: 10,
      conditions: {},
      cooldown: { days: 0, turns: 0 },
    });
    expect(withoutImportance.importance).toBe('side');
  });
});
