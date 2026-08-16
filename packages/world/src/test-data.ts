import type { EventDefinition, GameState } from '@ag/schemas';
import {
  createGameState,
  defaultCharacter,
  defaultRelationship,
  withCharacter,
  withRelationship,
} from '@ag/core';

export function makeWorldGameState(): GameState {
  let state = createGameState({
    runId: 'run_017',
    seed: 123456789,
    day: 1,
    time: '09:00',
    dailyProgressLimit: 12,
  });
  const character = defaultCharacter('char_mio', {
    identity: {
      name: 'Mio',
      age: 19,
      gender: 'female',
      genderIdentity: 'female',
      sexualOrientation: 'pansexual',
      role: '图书管理员',
      description: '',
    },
  });
  const relationship = defaultRelationship('player', 'char_mio', 'rel_player_mio', {
    type: 'acquaintance',
    affection: 30,
    trust: 40,
  });
  state = withCharacter(state, character);
  state = withRelationship(state, relationship);
  return state;
}

export function makeEventDefinition(overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    eventId: 'event_default',
    type: 'daily',
    rarity: 'common',
    title: '默认事件',
    description: '用于测试的事件定义。',
    baseWeight: 1,
    conditions: {},
    cooldown: { days: 0, turns: 0 },
    ...overrides,
  };
}
