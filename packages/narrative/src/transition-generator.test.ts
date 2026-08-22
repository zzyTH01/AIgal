import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import type { MemoryRecord } from '@ag/schemas';
import { fallbackTransition, generateTransition } from './transition-generator.js';

function memory(id: string, content: string): MemoryRecord {
  return {
    id,
    type: 'episodic',
    content,
    createdAt: { day: 1, time: '09:00' },
    importance: 40,
    emotionalIntensity: 30,
    valence: 10,
    strength: 45,
    accuracy: 90,
    tags: ['care'],
    relatedCharacters: ['char_mio'],
    sourceTurnId: 'run_001/day_001/turn_001',
    retrievalCount: 0,
  };
}

const baseInput = {
  npcName: 'Mio',
  lastTurn: {
    optionActions: ['approach', 'support'],
    reactionSummary: '她道了谢，神情放松了一些。',
    newMemoryContents: ['玩家主动帮忙整理书籍。'],
  },
  retrievedMemories: [memory('mem_1', '玩家在图书馆帮助过 Mio')],
  timeChange: { previous: '09:00', current: '09:30', crossedDayBoundary: false },
  locationChange: { fromLocationId: 'loc_library', toLocationId: 'loc_corridor' },
  environmentChanges: { weather: 'rain' },
};

describe('generateTransition', () => {
  it('parses LLM payload, filters referenced ids to the retrieved whitelist', async () => {
    const provider = new TestProvider(() => ({
      text: JSON.stringify({
        narration: '走廊安静下来，雨声敲着窗。',
        dialogues: [{ speakerId: 'char_mio', text: '……刚才的事，我还在想。' }],
        referencedMemoryIds: ['mem_1', 'mem_hallucinated'],
      }),
    }));
    const result = await generateTransition(baseInput, provider);
    expect(result.source).toBe('llm');
    expect(result.referencedMemoryIds).toEqual(['mem_1']);
  });

  it('falls back on invalid JSON and marks source fallback', async () => {
    const provider = TestProvider.fromText('not-json');
    const result = await generateTransition(baseInput, provider);
    expect(result.source).toBe('fallback');
    expect(result.narration.length).toBeGreaterThan(0);
  });

  it('retries once then succeeds with llmMaxAttempts=2', async () => {
    let calls = 0;
    const provider = new TestProvider(() => {
      calls += 1;
      if (calls === 1) throw new Error('flaky');
      return {
        text: JSON.stringify({
          narration: '过渡完成。',
          dialogues: [],
          referencedMemoryIds: [],
        }),
      };
    });
    const result = await generateTransition(baseInput, provider, { maxAttempts: 2 });
    expect(result.source).toBe('llm');
    expect(calls).toBe(2);
  });

  it('fallback template references time/location and last turn', () => {
    const result = fallbackTransition(baseInput);
    expect(result.source).toBe('fallback');
    expect(result.narration).toContain('09:30');
    expect(result.narration).toContain('loc_corridor');
    expect(result.narration).toContain('刚才的事');
    expect(result.referencedMemoryIds).toEqual([]);
  });

  it('crossed-day fallback mentions the new day', () => {
    const result = fallbackTransition({
      ...baseInput,
      lastTurn: undefined,
      timeChange: { previous: '23:30', current: '09:00', crossedDayBoundary: true },
    });
    expect(result.narration).toContain('新的一天');
  });
});
