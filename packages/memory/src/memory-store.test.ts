import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@ag/schemas';
import { MemoryStore } from './memory-store.js';
import { makeMemoryGameState } from './test-data.js';

function makeRecord(id: string): MemoryRecord {
  return {
    id,
    type: 'episodic',
    content: '测试记忆',
    createdAt: { day: 1, time: '09:00' },
    importance: 50,
    emotionalIntensity: 30,
    valence: 10,
    strength: 40,
    accuracy: 90,
    tags: ['test'],
    relatedCharacters: [],
    sourceTurnId: 'turn_1',
    retrievalCount: 0,
  };
}

describe('MemoryStore', () => {
  it('adds records into short-term and moves/forgets them', () => {
    const store = MemoryStore.fromMemoryState(makeMemoryGameState().memories);
    store.add(makeRecord('mem_1'));
    expect(store.get('mem_1')?.id).toBe('mem_1');
    expect(store.snapshot().shortTermIds).toContain('mem_1');

    store.moveToLongTerm('mem_1');
    expect(store.snapshot().longTermIds).toContain('mem_1');
    expect(store.snapshot().shortTermIds).not.toContain('mem_1');

    store.forget('mem_1');
    expect(store.snapshot().forgottenIds).toContain('mem_1');
    expect(store.activeRecords()).toHaveLength(0);
  });
});
