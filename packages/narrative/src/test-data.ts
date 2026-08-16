import type { GameState, ModelContext } from '@ag/schemas';
import {
  createGameState,
  defaultCharacter,
  defaultRelationship,
  withCharacter,
  withRelationship,
} from '@ag/core';

export function makeNarrativeGameState(): GameState {
  let state = createGameState({ runId: 'run_017', seed: 42 });
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

export function makeNarrativeContext(): ModelContext {
  const state = makeNarrativeGameState();
  return {
    schemaVersion: '0.1.0',
    runId: state.run.runId,
    turnId: `${state.run.runId}/day_001/turn_001`,
    day: state.run.day,
    time: state.run.time,
    systemRules: '你是图书管理员 Mio，保持角色一致。',
    currentState: state,
    recentEvents: [],
    retrievedMemories: [],
    internalState: {},
    generationTask: { task: 'generate_scenario_and_options', outputSchema: 'option.schema.json' },
    budget: {
      capacity: 80,
      systemRules: 15,
      currentState: 15,
      recentEvents: 20,
      memories: 20,
      internalState: 10,
    },
  };
}

export const scenarioJson = JSON.stringify({
  narrative: '图书馆里很安静，只有翻书声。Mio 抬头看了你一眼。',
  structured: {
    emotion: { type: 'calm', intensity: 30 },
    intent: { type: 'observe', intensity: 20 },
  },
});

export const optionPlansJson = JSON.stringify([
  {
    id: 'option_active_1',
    presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
    behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.15 },
    gameplay: { progress: 2 },
    effects: { affection: { base: 2 }, trust: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
  {
    id: 'option_conservative_1',
    presentation: { text: '我先在旁边等一会儿。', tone: 'calm' },
    behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.05 },
    gameplay: { progress: 0 },
    effects: { trust: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
  },
  {
    id: 'option_social_1',
    presentation: { text: '最近怎么样？', tone: 'friendly' },
    behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
    gameplay: { progress: 1 },
    effects: { familiarity: { base: 2 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
  {
    id: 'option_risk_1',
    presentation: { text: '其实我一直想约你出去。', tone: 'bold' },
    behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.45 },
    gameplay: { progress: 2 },
    effects: { affection: { base: 3 }, conflict: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
]);

export const reactionJson = JSON.stringify({
  narrative: '……嗯，你来了。',
  structured: {
    emotion: { type: 'relief', intensity: 70 },
    intent: { type: 'seek_closeness', intensity: 50 },
    memoryCandidates: [],
  },
});
