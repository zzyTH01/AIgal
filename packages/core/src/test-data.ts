import type { EndingDefinition, Option } from '@ag/schemas';
import {
  createGameState,
  defaultCharacter,
  defaultRelationship,
  withCharacter,
  withRelationship,
} from './game-state.js';

export function makeCoreGameState(): ReturnType<typeof createGameState> {
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
      role: '图书馆管理员',
      description: '安静但观察力敏锐的图书管理员。',
    },
    personality: {
      traits: { gentle: 80 },
      independence: 80,
      confidence: 55,
      sociability: 40,
      sensitivity: 75,
      assertiveness: 45,
      empathy: 80,
      openness: 60,
    },
    psychology: {
      dependence: 30,
      security: 55,
      loneliness: 60,
      stress: 35,
      jealousy: 15,
      selfWorth: 50,
      emotionalStability: 60,
      romanticTension: 20,
    },
  });

  const relationship = defaultRelationship('player', 'char_mio', 'rel_player_mio', {
    type: 'acquaintance',
    affection: 30,
    trust: 40,
    intimacy: 10,
    familiarity: 35,
    attraction: 25,
    conflict: 5,
    respect: 50,
    dependency: 10,
  });

  state = withCharacter(state, character);
  state = withRelationship(state, relationship);
  return state;
}

export const supportOption: Option = {
  id: 'option_support',
  presentation: { text: '这次你自己试试看，我相信你。', tone: 'supportive' },
  behavior: {
    actions: ['support', 'respect', 'encourage_independence'],
    intent: ['care', 'encouragement'],
    risk: 0.15,
  },
  gameplay: { progress: 2 },
  effects: { affection: { base: 2 }, trust: { base: 4 } },
  conditions: { trust: { min: 20 } },
  generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
};

export const restOption: Option = {
  id: 'option_rest',
  presentation: { text: '先休息一下吧。', tone: 'calm' },
  behavior: { actions: ['rest'], intent: ['care'], risk: 0.05 },
  gameplay: { progress: 1 },
  effects: { affection: { base: 0 }, trust: { base: 1 } },
  conditions: {},
  generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
};

export const makeEndings = (): EndingDefinition[] => [
  {
    endingId: 'ending_good',
    kind: 'good',
    title: 'Good End',
    description: '好感与信任都足够高。',
    conditions: { 'relationship.affection': { min: 60 }, 'relationship.trust': { min: 60 } },
    priority: 30,
  },
  {
    endingId: 'ending_normal',
    kind: 'normal',
    title: 'Normal End',
    description: '平安度过。',
    conditions: { 'run.day': { min: 3 } },
    priority: 10,
  },
  {
    endingId: 'ending_bad',
    kind: 'bad',
    title: 'Bad End',
    description: '信任崩塌。',
    conditions: { 'relationship.trust': { max: 10 } },
    priority: 50,
  },
];
