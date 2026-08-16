import { type GameState, type ModelContext } from '@ag/schemas';
import { createGameState, defaultRelationship, definitionToGameCharacter } from '@ag/core';
import { XorShift128Rng } from '@ag/world';
import { buildContext } from '@ag/context';
import { runNarrativeTurn } from '@ag/narrative';
import { TestProvider, type LLMGateway } from '@ag/llm';
import { demoCharacter } from '@ag/runtime';

export interface GoldenTurnResult {
  seed: number;
  fingerprint: string;
  scenarioText: string;
  optionIds: string[];
  reactionText: string;
  directDeltaSummary: string;
}

const COMBINED_JSON = JSON.stringify({
  scenario: { narrative: '图书馆里很安静，Mio 抬头看了你一眼。', structured: {} },
  options: [
    {
      id: 'option_support',
      presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
      behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.15 },
      gameplay: { progress: 2 },
      effects: { affection: { base: 2 }, trust: { base: 1 } },
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
    },
    {
      id: 'option_observe',
      presentation: { text: '我先看看书。', tone: 'calm' },
      behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.05 },
      gameplay: { progress: 0 },
      effects: { trust: { base: 1 } },
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
    },
    {
      id: 'option_chat',
      presentation: { text: '最近有什么推荐吗？', tone: 'friendly' },
      behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: { familiarity: { base: 2 } },
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
    },
    {
      id: 'option_risk',
      presentation: { text: '其实我想更了解你。', tone: 'bold' },
      behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.45 },
      gameplay: { progress: 2 },
      effects: { affection: { base: 3 }, conflict: { base: 1 } },
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
    },
  ],
});

const REACTION_JSON = JSON.stringify({
  narrative: '……嗯，你来了。',
  structured: { emotion: { type: 'relief', intensity: 70 } },
});

/** 端到端 Golden Test：固定 seed + GameState + LLM Fixture → 可复现输出。 */
export async function runGoldenTurn(
  seed = 42,
  gateway: LLMGateway = TestProvider.fromText(COMBINED_JSON, REACTION_JSON),
): Promise<GoldenTurnResult> {
  const state = makeGoldenState(seed);
  const context = makeGoldenContext(state);
  const result = await runNarrativeTurn(context, state, gateway, {
    rng: new XorShift128Rng(seed),
  });

  const directDeltaSummary = Object.entries(result.resolution.directDelta.relationships ?? {})
    .flatMap(([relationshipId, metrics]) =>
      Object.entries(metrics).map(
        ([metric, change]) =>
          `${relationshipId}.${metric}:${change.before}->${change.after}:${change.delta}`,
      ),
    )
    .join(';');

  const fingerprint = hashJson({
    scenario: result.scenario.narrative,
    options: result.options.map((option) => option.id),
    reaction: result.reaction.narrative,
    directDeltaSummary,
  });

  return {
    seed,
    fingerprint,
    scenarioText: result.scenario.narrative,
    optionIds: result.options.map((option) => option.id),
    reactionText: result.reaction.narrative,
    directDeltaSummary,
  };
}

function makeGoldenState(seed: number): GameState {
  const state = createGameState({ runId: `run_golden_${seed}`, seed, day: 1, time: '09:00' });
  state.characters[demoCharacter.characterId] = definitionToGameCharacter(demoCharacter);
  state.relationships.rel_player = defaultRelationship(
    'player',
    demoCharacter.characterId,
    'rel_player',
    { type: demoCharacter.relationshipDefaults.initialType },
  );
  return state;
}

function makeGoldenContext(state: GameState): ModelContext {
  return buildContext(state, {
    characterId: demoCharacter.characterId,
    systemRules: `你是${demoCharacter.identity.name}，保持角色一致性。`,
    query: { tags: ['library'], text: '图书馆' },
  });
}

function hashJson(payload: unknown): string {
  const text = JSON.stringify(payload);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
