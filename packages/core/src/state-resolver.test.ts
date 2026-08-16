import { describe, expect, it } from 'vitest';
import {
  baseStateDeltaSchema,
  finalStateDeltaSchema,
  modifierStateDeltaSchema,
  type Option,
} from '@ag/schemas';
import { cloneGameState, defaultCharacter, withCharacter } from './game-state.js';
import { ALWAYS_SUCCESS_RNG, type RNG } from './rng.js';
import { observePlayerChoice, resolveChoice } from './state-resolver.js';
import { makeCoreGameState, supportOption } from './test-data.js';

function makeDependentState() {
  const state = makeCoreGameState();
  const dependent = defaultCharacter('char_mio', {
    personality: {
      traits: {},
      independence: 30,
      confidence: 45,
      sociability: 50,
      sensitivity: 80,
      assertiveness: 40,
      empathy: 80,
      openness: 60,
    },
    psychology: {
      dependence: 70,
      security: 50,
      loneliness: 55,
      stress: 35,
      jealousy: 10,
      selfWorth: 50,
      emotionalStability: 60,
      romanticTension: 25,
    },
  });
  return withCharacter(state, dependent);
}

describe('StateResolver modifier engine', () => {
  it('produces different deltas for the same Option with different Characters', () => {
    const independent = makeCoreGameState();
    const dependent = makeDependentState();
    const rng = ALWAYS_SUCCESS_RNG;

    const independentResult = resolveChoice(independent, supportOption, rng);
    const dependentResult = resolveChoice(dependent, supportOption, rng);

    const independentAffection = independentResult.trace.find((t) => t.metric === 'affection')!;
    const dependentAffection = dependentResult.trace.find((t) => t.metric === 'affection')!;
    expect(independentAffection.delta).toBeLessThan(0);
    expect(dependentAffection.delta).toBeGreaterThan(0);
    expect(independentAffection.delta).toBeLessThan(dependentAffection.delta);
  });

  it('ignores illegal AI base values and recomputes from behavior rules', () => {
    const state = makeDependentState();
    const illegalOption: Option = {
      ...supportOption,
      effects: { affection: { base: 5000 }, trust: { base: Number.POSITIVE_INFINITY } },
    };
    const result = resolveChoice(state, illegalOption, ALWAYS_SUCCESS_RNG);

    const affection = result.trace.find((entry) => entry.metric === 'affection')!;
    const trust = result.trace.find((entry) => entry.metric === 'trust')!;
    expect(affection.base).toBe(2);
    expect(trust.base).toBe(2);
    expect(affection.after).toBeLessThanOrEqual(100);
    expect(trust.after).toBeLessThanOrEqual(100);
    expect(baseStateDeltaSchema.safeParse(result.baseDelta).success).toBe(true);
    expect(modifierStateDeltaSchema.safeParse(result.modifierDelta).success).toBe(true);
    expect(finalStateDeltaSchema.safeParse(result.directDelta).success).toBe(true);
  });

  it('applies nonlinear feedback near the upper bound', () => {
    const low = makeDependentState();
    const high = makeDependentState();
    low.relationships.rel_player_mio!.affection = 20;
    high.relationships.rel_player_mio!.affection = 80;

    const lowResult = resolveChoice(low, supportOption, ALWAYS_SUCCESS_RNG);
    const highResult = resolveChoice(high, supportOption, ALWAYS_SUCCESS_RNG);
    const lowDelta = lowResult.trace.find((entry) => entry.metric === 'affection')!.delta;
    const highDelta = highResult.trace.find((entry) => entry.metric === 'affection')!.delta;

    expect(
      highResult.trace.find((entry) => entry.metric === 'affection')!.nonlinearFactor,
    ).toBeLessThan(lowResult.trace.find((entry) => entry.metric === 'affection')!.nonlinearFactor);
    expect(highDelta).toBeLessThan(lowDelta);
    expect(
      highResult.directDelta.relationships?.rel_player_mio?.affection?.after,
    ).toBeLessThanOrEqual(100);
  });

  it('reduces repeated support behaviors and can turn them negative', () => {
    const state = makeDependentState();
    const repeated = makeDependentState();
    repeated.playerModel.recentBehaviorPattern = Array.from({ length: 10 }, () => 'support');
    repeated.playerModel.behavioralPatterns.player_support = 10;

    const freshResult = resolveChoice(state, supportOption, ALWAYS_SUCCESS_RNG);
    const repeatedResult = resolveChoice(repeated, supportOption, ALWAYS_SUCCESS_RNG);

    const fresh = freshResult.trace.find((entry) => entry.metric === 'affection')!;
    const grind = repeatedResult.trace.find((entry) => entry.metric === 'affection')!;
    expect(grind.repetitionModifier).toBeLessThan(0);
    expect(grind.delta).toBeLessThan(fresh.delta);
  });

  it('branches risk by injected RNG outcome', () => {
    const state = makeDependentState();
    const successRng: RNG = { next: () => 0 };
    const failureRng: RNG = { next: () => 0.999 };

    const success = resolveChoice(state, supportOption, successRng);
    const failure = resolveChoice(state, supportOption, failureRng);

    expect(success.riskOutcome).toBe('success');
    expect(failure.riskOutcome).toBe('failure');
    expect(failure.trace.find((entry) => entry.metric === 'affection')!.delta).toBeLessThanOrEqual(
      0,
    );
    expect(
      success.trace.find((entry) => entry.metric === 'affection')!.delta,
    ).toBeGreaterThanOrEqual(failure.trace.find((entry) => entry.metric === 'affection')!.delta);
  });

  it('clamps resolved after-values to 0~100', () => {
    const state = makeDependentState();
    state.relationships.rel_player_mio!.affection = 99;
    state.relationships.rel_player_mio!.trust = 0;
    const option: Option = {
      ...supportOption,
      effects: { affection: { base: 10 }, trust: { base: -10 } },
    };

    const result = resolveChoice(state, option, ALWAYS_SUCCESS_RNG);
    expect(result.directDelta.relationships?.rel_player_mio?.affection?.after).toBeLessThanOrEqual(
      100,
    );
    expect(result.directDelta.relationships?.rel_player_mio?.trust?.after).toBeGreaterThanOrEqual(
      0,
    );
  });

  it('observes player choice into recent behavior pattern without mutating input', () => {
    const state = makeCoreGameState();
    const snapshot = cloneGameState(state);
    const next = observePlayerChoice(state, supportOption);
    expect(next.playerModel.recentBehaviorPattern).toContain('support');
    expect(next.playerModel.behavioralPatterns.player_support).toBeGreaterThanOrEqual(1);
    expect(state.playerModel.recentBehaviorPattern).toEqual(
      snapshot.playerModel.recentBehaviorPattern,
    );
  });
});
