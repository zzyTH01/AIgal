import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@ag/schemas';
import { pruneMemories } from './prune.js';
import { makeMemoryGameState } from './test-data.js';

function add(
  state: ReturnType<typeof makeMemoryGameState>,
  id: string,
  strength: number,
  longTerm = false,
) {
  const record: MemoryRecord = {
    id,
    type: 'episodic',
    content: id,
    createdAt: { day: 1, time: '09:00' },
    importance: 40,
    emotionalIntensity: 30,
    valence: 0,
    strength,
    accuracy: 90,
    tags: [],
    relatedCharacters: [],
    sourceTurnId: 't',
    retrievalCount: 0,
  };
  state.memories.records[id] = record;
  (longTerm ? state.memories.longTermIds : state.memories.shortTermIds).push(id);
}

describe('pruneMemories', () => {
  it('keeps top records and forgets the rest', () => {
    const state = makeMemoryGameState();
    add(state, 'mem_weak', 10);
    add(state, 'mem_strong', 90);
    add(state, 'mem_medium', 50);
    const next = pruneMemories(state, { maxRecords: 2 });
    expect(next.memories.records.mem_weak).toBeUndefined();
    expect(next.memories.records.mem_strong).toBeDefined();
    expect(next.memories.records.mem_medium).toBeDefined();
    expect(next.memories.shortTermIds).not.toContain('mem_weak');
  });
});
