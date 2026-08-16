import type { GameState } from '@ag/schemas';
import {
  ALWAYS_SUCCESS_RNG,
  applyBadEndPunishment,
  createGameState,
  defaultCharacter,
  defaultRelationship,
  definitionToGameCharacter,
  resolveChoice,
  startNewRunFromMeta,
  withCharacter,
  withRelationship,
} from '@ag/core';
import { buildContext } from '@ag/context';
import { formMemory } from '@ag/memory';
import { runGoldenTurn } from './golden-test.js';
import { demoCharacter, type RuntimeConfig } from '@ag/runtime';

export interface V1AcceptanceResult {
  memoryInContext: boolean;
  differentCharacterDifferentDelta: boolean;
  metaProgressionInherited: boolean;
  passed: boolean;
}

/** 自动化验证 V1 成功标准（真实 LLM 的端到端脚本可复用本函数）。 */
export async function runV1Acceptance(): Promise<V1AcceptanceResult> {
  const memoryResult = await verifyMemoryInContext();
  const deltaResult = verifySameOptionDifferentCharacter();
  const metaResult = verifyMetaProgression();

  return {
    memoryInContext: memoryResult,
    differentCharacterDifferentDelta: deltaResult,
    metaProgressionInherited: metaResult,
    passed: memoryResult && deltaResult && metaResult,
  };
}

async function verifyMemoryInContext(): Promise<boolean> {
  let state = createGameState({ runId: 'run_acceptance', seed: 42 });
  state = withCharacter(state, definitionToGameCharacter(demoCharacter));
  state = withRelationship(
    state,
    defaultRelationship('player', demoCharacter.characterId, 'rel_player', {
      type: demoCharacter.relationshipDefaults.initialType,
    }),
  );
  const formed = formMemory(
    state,
    {
      type: 'episodic',
      content: '玩家曾在雨天陪明日香整理旧物。',
      importance: 70,
      emotionalIntensity: 60,
      valence: 25,
      tags: ['rain', 'help'],
      relatedCharacters: [demoCharacter.characterId],
      sourceTurnId: 'run_acceptance/day_001/turn_001',
    },
    demoCharacter.cognition,
  );
  const context = buildContext(formed.state, {
    characterId: demoCharacter.characterId,
    query: { tags: ['rain'], text: '雨天 整理' },
  });
  const golden = await runGoldenTurn(42);
  return (
    context.retrievedMemories.some((memory) => memory.tags.includes('rain')) &&
    golden.fingerprint.length === 8
  );
}

function verifySameOptionDifferentCharacter(): boolean {
  const option = {
    id: 'option_support',
    presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
    behavior: { actions: ['support', 'help'], intent: ['care'], risk: 0.1 },
    gameplay: { progress: 2 },
    effects: { affection: { base: 2 }, trust: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' as const },
  };

  const independent = makeAcceptanceState('char_independent', 90, 30);
  const dependent = makeAcceptanceState('char_dependent', 30, 80);
  const a = resolveChoice(independent, option, ALWAYS_SUCCESS_RNG);
  const b = resolveChoice(dependent, option, ALWAYS_SUCCESS_RNG);
  const deltaA = a.trace.find((entry) => entry.metric === 'affection')?.delta ?? 0;
  const deltaB = b.trace.find((entry) => entry.metric === 'affection')?.delta ?? 0;
  return deltaA !== deltaB;
}

function makeAcceptanceState(
  characterId: string,
  independence: number,
  empathy: number,
): GameState {
  let state = createGameState({ runId: `run_${characterId}`, seed: 1 });
  state = withCharacter(
    state,
    defaultCharacter(characterId, {
      personality: {
        traits: {},
        independence,
        confidence: 50,
        sociability: 50,
        sensitivity: 50,
        assertiveness: 50,
        empathy,
        openness: 50,
      },
    }),
  );
  state = withRelationship(state, defaultRelationship('player', characterId, `rel_${characterId}`));
  return state;
}

function verifyMetaProgression(): boolean {
  let state = createGameState({ runId: 'run_017', seed: 3 });
  const bad = {
    endingId: 'ending_bad_acceptance',
    kind: 'bad' as const,
    title: 'Bad End',
    description: '验收坏结局',
    conditions: {},
    priority: 50,
  };
  state = applyBadEndPunishment(state, bad);
  state.meta.permanentModifiers.starting_trust = 8;
  const next = startNewRunFromMeta(state.meta, { runId: 'run_018', seed: 4 });
  return (
    next.meta.endingsDiscovered.includes(bad.endingId) &&
    next.meta.runCount === state.meta.runCount + 1 &&
    next.relationships.rel_player?.trust === 8
  );
}

export type { RuntimeConfig };
