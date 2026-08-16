import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@ag/schemas';
import { consolidateMemories } from './consolidation.js';
import { cognition, makeMemoryGameState } from './test-data.js';

function addShort(
  state: ReturnType<typeof makeMemoryGameState>,
  id: string,
  strength: number,
  importance = 50,
): void {
  const record: MemoryRecord = {
    id,
    type: 'episodic',
    content: `${id} 内容`,
    createdAt: { day: 1, time: '09:00' },
    importance,
    emotionalIntensity: 40,
    valence: 0,
    strength,
    accuracy: 90,
    tags: [],
    relatedCharacters: [],
    sourceTurnId: 'turn_1',
    retrievalCount: 0,
  };
  state.memories.records[id] = record;
  state.memories.shortTermIds.push(id);
}

describe('MemoryConsolidation', () => {
  it('moves strong short-term memories to long-term and forgets weak ones', () => {
    const state = makeMemoryGameState();
    addShort(state, 'mem_strong', 80);
    addShort(state, 'mem_weak', 10);

    const next = consolidateMemories(state, 2, cognition);
    expect(next.memories.longTermIds).toContain('mem_strong');
    expect(next.memories.forgottenIds).toContain('mem_weak');
    expect(next.memories.lastConsolidatedDay).toBe(2);
  });

  it('keeps high-importance weak memories in long-term', () => {
    const state = makeMemoryGameState();
    addShort(state, 'mem_important', 10, 90);
    const next = consolidateMemories(state, 2, cognition);
    expect(next.memories.longTermIds).toContain('mem_important');
    expect(next.memories.forgottenIds).not.toContain('mem_important');
  });
});
