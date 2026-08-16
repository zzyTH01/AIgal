import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@ag/schemas';
import { retrieveAndReinforce, retrieveMemories } from './retrieval.js';
import { cognition, makeMemoryGameState } from './test-data.js';

function addRecord(state: ReturnType<typeof makeMemoryGameState>, record: MemoryRecord) {
  state.memories.records[record.id] = record;
  state.memories.shortTermIds.push(record.id);
  return state;
}

describe('MemoryRetrieval', () => {
  it('ranks relevant, important, strong memories first', () => {
    const state = makeMemoryGameState();
    addRecord(state, {
      id: 'mem_irrelevant',
      type: 'episodic',
      content: '天气很好。',
      createdAt: { day: 1, time: '09:00' },
      importance: 80,
      emotionalIntensity: 80,
      valence: 0,
      strength: 90,
      accuracy: 90,
      tags: ['weather'],
      relatedCharacters: [],
      sourceTurnId: 'turn_1',
      retrievalCount: 0,
    });
    addRecord(state, {
      id: 'mem_relevant',
      type: 'episodic',
      content: 'Mio 喜欢图书馆的雨天。',
      createdAt: { day: 1, time: '09:00' },
      importance: 40,
      emotionalIntensity: 40,
      valence: 10,
      strength: 50,
      accuracy: 90,
      tags: ['library', 'rain'],
      relatedCharacters: [],
      sourceTurnId: 'turn_2',
      retrievalCount: 0,
    });

    const retrieved = retrieveMemories(
      state,
      { tags: ['library'], text: '图书馆 雨天' },
      cognition,
      { topK: 2 },
    );
    expect(retrieved[0]?.id).toBe('mem_relevant');
  });

  it('retrieval reinforces retrieved memories', () => {
    const state = makeMemoryGameState();
    addRecord(state, {
      id: 'mem_1',
      type: 'episodic',
      content: 'Mio 记住了你的帮助。',
      createdAt: { day: 1, time: '09:00' },
      importance: 60,
      emotionalIntensity: 50,
      valence: 20,
      strength: 42,
      accuracy: 90,
      tags: ['help'],
      relatedCharacters: [],
      sourceTurnId: 'turn_1',
      retrievalCount: 0,
    });

    const result = retrieveAndReinforce(state, { tags: ['help'] }, cognition, { topK: 1 });
    expect(result.records).toHaveLength(1);
    expect(result.state.memories.records.mem_1?.strength).toBe(68);
    expect(state.memories.records.mem_1?.strength).toBe(42);
  });
});
