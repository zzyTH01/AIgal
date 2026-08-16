import { describe, expect, it } from 'vitest';
import { formMemory } from './formation.js';
import { cognition, makeCandidate, makeMemoryGameState } from './test-data.js';

describe('MemoryFormation', () => {
  it('accepts a high-scoring candidate into short-term memory', () => {
    const state = makeMemoryGameState();
    const result = formMemory(state, makeCandidate(), cognition);
    expect(result.accepted).toBe(true);
    expect(result.record).toBeDefined();
    expect(result.state.memories.shortTermIds).toContain(result.record!.id);
  });

  it('rejects a low-scoring candidate', () => {
    const state = makeMemoryGameState();
    const result = formMemory(
      state,
      makeCandidate({ importance: 5, emotionalIntensity: 5 }),
      cognition,
    );
    expect(result.accepted).toBe(false);
    expect(Object.keys(result.state.memories.records)).toHaveLength(0);
  });

  it('does not mutate input state', () => {
    const state = makeMemoryGameState();
    formMemory(state, makeCandidate(), cognition);
    expect(state.memories.shortTermIds).toHaveLength(0);
  });
});
