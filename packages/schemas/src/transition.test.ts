import { describe, expect, it } from 'vitest';
import {
  transitionDialogueSchema,
  transitionLlmSchema,
  transitionNarrativeSchema,
  transitionRecordSchema,
} from './transition.js';

describe('Transition contracts', () => {
  it('parses a full transition record', () => {
    const record = transitionRecordSchema.parse({
      schemaVersion: '0.1.0',
      turnId: 'run_001/day_001/turn_002',
      time: { previous: '09:00', current: '09:30', crossedDayBoundary: false },
      location: { fromLocationId: 'loc_library', toLocationId: 'loc_corridor' },
      environment: { weather: 'rain', crowd: 'sparse' },
      emotionalAftermath: { referencedMemoryIds: ['mem_1'], summary: '还在想着刚才的谈话' },
      pendingIntentIds: [],
      narrative: {
        narration: '午后的走廊安静下来。',
        dialogues: [{ speakerId: 'char_mio', text: '……你刚才说的话，我想了很久。' }],
        source: 'llm',
      },
    });
    expect(record.narrative.dialogues[0]?.speakerId).toBe('char_mio');
  });

  it('defaults pendingIntentIds and allows first-turn null fromLocation', () => {
    const record = transitionRecordSchema.parse({
      schemaVersion: '0.1.0',
      turnId: 'run_001/day_001/turn_001',
      time: { previous: '09:00', current: '09:00', crossedDayBoundary: false },
      location: { fromLocationId: null, toLocationId: 'loc_library' },
      narrative: { narration: '开场。', dialogues: [], source: 'fallback' },
    });
    expect(record.pendingIntentIds).toEqual([]);
  });

  it('rejects empty narration and unknown source', () => {
    expect(
      transitionNarrativeSchema.safeParse({ narration: '', dialogues: [], source: 'llm' }).success,
    ).toBe(false);
    expect(
      transitionNarrativeSchema.safeParse({ narration: 'x', dialogues: [], source: 'magic' })
        .success,
    ).toBe(false);
    expect(transitionDialogueSchema.safeParse({ speakerId: 'narrator', text: '' }).success).toBe(
      false,
    );
  });

  it('parses LLM payload with referenced memories and optional candidate', () => {
    const base = {
      narration: '她停下脚步。',
      dialogues: [{ speakerId: 'char_mio', text: '昨天的事，我后来想了很久。' }],
    };
    const parsed = transitionLlmSchema.parse({
      ...base,
      referencedMemoryIds: ['mem_7'],
      memoryCandidate: {
        type: 'episodic',
        content: '角色在傍晚回想玩家的帮助',
        importance: 40,
        emotionalIntensity: 30,
        valence: 10,
        tags: ['care'],
        relatedCharacters: ['char_mio'],
        sourceTurnId: 'run_001/day_001/turn_002',
      },
    });
    expect(parsed.referencedMemoryIds).toEqual(['mem_7']);
    expect(transitionLlmSchema.parse(base).referencedMemoryIds).toEqual([]);
  });
});
