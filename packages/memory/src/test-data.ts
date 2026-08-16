import type { CognitionState, GameState, MemoryCandidate } from '@ag/schemas';
import { createGameState } from '@ag/core';

export const cognition: CognitionState = {
  memoryCapacity: 80,
  encoding: 70,
  retention: 75,
  retrieval: 65,
  forgetfulness: 30,
  grudge: 20,
  obsession: 25,
  attention: 70,
  emotionalSalience: 60,
  cognitiveLoad: 30,
};

export function makeMemoryGameState(): GameState {
  return createGameState({ runId: 'run_mem', seed: 1, day: 1, time: '09:00' });
}

export function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    type: 'episodic',
    content: '玩家在图书馆帮 Mio 整理了新书。',
    importance: 40,
    emotionalIntensity: 25,
    valence: 15,
    tags: ['library', 'help'],
    relatedCharacters: ['char_mio'],
    sourceTurnId: 'run_mem/day_001/turn_001',
    ...overrides,
  };
}
