import type { EventInstance, GameState, MemoryRecord } from '@ag/schemas';
import {
  createGameState,
  defaultCharacter,
  defaultRelationship,
  withCharacter,
  withRelationship,
} from '@ag/core';

export function makeContextGameState(): GameState {
  let state = createGameState({ runId: 'run_ctx', seed: 1, day: 1, time: '09:00' });
  state = withCharacter(
    state,
    defaultCharacter('char_mio', {
      identity: {
        name: 'Mio',
        age: 19,
        gender: 'female',
        genderIdentity: 'female',
        sexualOrientation: 'pansexual',
        role: '图书管理员',
        description: '',
      },
      cognition: {
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
      },
    }),
  );
  state = withRelationship(
    state,
    defaultRelationship('player', 'char_mio', 'rel_player_mio', {
      type: 'acquaintance',
      affection: 30,
      trust: 40,
    }),
  );
  return state;
}

export function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem_1',
    type: 'episodic',
    content: '玩家曾在雨天帮 Mio 整理旧报刊。',
    createdAt: { day: 1, time: '09:00' },
    importance: 70,
    emotionalIntensity: 60,
    valence: 25,
    strength: 80,
    accuracy: 90,
    tags: ['rain', 'help', 'library'],
    relatedCharacters: ['char_mio'],
    sourceTurnId: 'run_ctx/day_001/turn_001',
    retrievalCount: 0,
    ...overrides,
  };
}

export function makeEventInstance(): EventInstance {
  return {
    instanceId: 'event_instance_1',
    eventId: 'event_rain',
    runId: 'run_ctx',
    day: 1,
    turn: 0,
    locationId: 'loc_start',
    title: '雨天',
    description: '窗外下起了雨。',
    status: 'active',
    createdAt: { day: 1, time: '09:00' },
  };
}
