import { describe, expect, it } from 'vitest';
import {
  evaluateCondition,
  evaluateConditions,
  getFlag,
  resolveConditionValues,
  setFlag,
  unsetFlag,
} from './rule-engine.js';
import { makeCoreGameState } from './test-data.js';

describe('RuleEngine flag read/write', () => {
  it('sets, gets and unsets flags without mutating input', () => {
    const state = makeCoreGameState();
    const withFlag = setFlag(state, 'helped_today', true);
    expect(getFlag(withFlag, 'helped_today')).toBe(true);
    expect(state.flags.helped_today).toBeUndefined();

    const removed = unsetFlag(withFlag, 'helped_today');
    expect(getFlag(removed, 'helped_today')).toBeUndefined();
  });
});

describe('RuleEngine conditions', () => {
  it('resolves run/world/flag/relationship paths', () => {
    const state = makeCoreGameState();
    expect(resolveConditionValues(state, 'run.day')).toEqual([1]);
    expect(resolveConditionValues(state, 'world.weather.type')).toEqual(['clear']);
    expect(resolveConditionValues(state, 'flags.missing')).toEqual([undefined]);
    expect(resolveConditionValues(state, 'relationship.rel_player_mio.affection')).toEqual([30]);
    expect(resolveConditionValues(state, 'relationship.affection')).toContain(30);
  });

  it('evaluates numeric ranges and exact matches', () => {
    const state = makeCoreGameState();
    expect(evaluateCondition(state, 'run.day', { min: 1, max: 3 })).toBe(true);
    expect(evaluateCondition(state, 'run.day', { min: 2 })).toBe(false);
    expect(evaluateCondition(state, 'world.weather.type', 'clear')).toBe(true);
    expect(evaluateCondition(state, 'relationship.trust', { min: 40 })).toBe(true);
  });

  it('evaluates an all-or-nothing condition set', () => {
    const state = makeCoreGameState();
    expect(
      evaluateConditions(state, {
        'run.day': { min: 1 },
        'relationship.trust': { min: 20 },
      }),
    ).toBe(true);
    expect(
      evaluateConditions(state, {
        'run.day': { min: 1 },
        'relationship.trust': { min: 41 },
      }),
    ).toBe(false);
  });
});
