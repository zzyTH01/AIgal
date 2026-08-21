import { describe, expect, it } from 'vitest';
import type { MemoryRecord } from '@ag/schemas';
import { decayedStrength, decayMemoryRecord } from './decay.js';
import { reinforceMemoryRecord } from './reinforcement.js';
import { cognition, makeMemoryGameState } from './test-data.js';

function makeRecord(strength: number, day = 1): MemoryRecord {
  return {
    id: 'mem_1',
    type: 'episodic',
    content: '记忆内容',
    createdAt: { day, time: '09:00' },
    importance: 50,
    emotionalIntensity: 40,
    valence: 0,
    strength,
    accuracy: 90,
    tags: [],
    relatedCharacters: [],
    sourceTurnId: 'turn_1',
    retrievalCount: 0,
  };
}

describe('MemoryDecay and Reinforcement', () => {
  it('decays older memories more than fresh ones', () => {
    const fresh = decayedStrength(makeRecord(80, 1), 2, cognition);
    const old = decayedStrength(makeRecord(80, 1), 10, cognition);
    expect(fresh).toBeGreaterThan(old);
    expect(fresh).toBeLessThan(80);
  });

  it('preserves negative grudge memories more than neutral ones', () => {
    const neutral = makeRecord(80, 1);
    const grudge: MemoryRecord = { ...makeRecord(80, 1), valence: -60 };
    expect(decayMemoryRecord(neutral, 10, cognition).strength).toBeLessThan(
      decayMemoryRecord(grudge, 10, cognition).strength,
    );
  });

  it('uses lastRetrievedAt to reset the decay clock', () => {
    const reinforced: MemoryRecord = {
      ...makeRecord(80, 1),
      lastRetrievedAt: { day: 8, time: '09:00' },
    };
    const notReinforced = makeRecord(80, 1);
    expect(decayedStrength(reinforced, 10, cognition)).toBeGreaterThan(
      decayedStrength(notReinforced, 10, cognition),
    );
  });

  it('reinforces memory strength and retrieval metadata', () => {
    const state = makeMemoryGameState();
    state.memories.records.mem_1 = makeRecord(42);
    state.memories.shortTermIds.push('mem_1');
    const next = reinforceMemoryRecord(state, 'mem_1', 1);
    expect(next.memories.records.mem_1?.strength).toBe(54);
    expect(next.memories.records.mem_1?.retrievalCount).toBe(1);
    expect(next.memories.records.mem_1?.lastRetrievedAt?.day).toBe(1);
  });

  it('skips reinforcement within the cooldown window', () => {
    const state = makeMemoryGameState();
    state.memories.records.mem_1 = makeRecord(42);
    const first = reinforceMemoryRecord(state, 'mem_1', 1);
    expect(first.memories.records.mem_1?.strength).toBe(54);

    const sameDay = reinforceMemoryRecord(first, 'mem_1', 1);
    expect(sameDay.memories.records.mem_1?.strength).toBe(54);
    expect(sameDay.memories.records.mem_1?.retrievalCount).toBe(1);

    const nextDay = reinforceMemoryRecord(first, 'mem_1', 2);
    expect(nextDay.memories.records.mem_1?.strength).toBe(66);
    expect(nextDay.memories.records.mem_1?.retrievalCount).toBe(2);
  });

  it('supports legacy numeric boost argument without cooldown override', () => {
    const state = makeMemoryGameState();
    state.memories.records.mem_1 = makeRecord(42);
    const boosted = reinforceMemoryRecord(state, 'mem_1', 1, 26);
    expect(boosted.memories.records.mem_1?.strength).toBe(68);
  });
});
