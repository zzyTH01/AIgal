import { describe, expect, it } from 'vitest';
import { finalStateDeltaSchema } from '@ag/schemas';
import {
  applyDelta,
  clamp,
  clampStateValues,
  cloneGameState,
  createGameState,
  defaultCharacter,
  diffGameStates,
  validateGameState,
} from './game-state.js';
import { makeCoreGameState } from './test-data.js';

describe('GameState factory', () => {
  it('creates a valid minimal GameState', () => {
    const state = createGameState({ runId: 'run_001', seed: 42 });
    expect(validateGameState(state).success).toBe(true);
    expect(state.run.day).toBe(1);
    expect(state.run.turn).toBe(0);
    expect(state.world.locations.loc_start?.name).toBe('起点');
  });

  it('creates an adult default character', () => {
    const character = defaultCharacter('char_test');
    expect(character.identity.age).toBe(18);
    expect(character.status).toBe('active');
  });
});

describe('clamp and cloning', () => {
  it('clamps numeric values', () => {
    expect(clamp(101, 0, 100)).toBe(100);
    expect(clamp(-1, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });

  it('clones deeply without sharing nested objects', () => {
    const state = makeCoreGameState();
    const clone = cloneGameState(state);
    clone.characters.char_mio!.psychology.stress = 99;
    expect(state.characters.char_mio!.psychology.stress).toBe(35);
  });

  it('clamps all state values back into legal bounds', () => {
    const state = makeCoreGameState();
    state.characters.char_mio!.psychology.stress = 140;
    state.relationships.rel_player_mio!.affection = -10;
    state.world.weather.visibility = 200;
    const clamped = clampStateValues(state);
    expect(clamped.characters.char_mio!.psychology.stress).toBe(100);
    expect(clamped.relationships.rel_player_mio!.affection).toBe(0);
    expect(clamped.world.weather.visibility).toBe(100);
  });
});

describe('applyDelta', () => {
  it('applies final relationship deltas with clamping and does not mutate input', () => {
    const before = makeCoreGameState();
    const delta = finalStateDeltaSchema.parse({
      phase: 'final',
      run: { turn: 1, dailyProgress: 2 },
      relationships: {
        rel_player_mio: {
          affection: { before: 30, after: 32, delta: 2 },
          trust: { before: 40, after: 101, delta: 61 },
        },
      },
      flags: { set: { helped_today: true }, unset: ['avoided_today'] },
    });
    const after = applyDelta(before, delta);
    expect(after.run.turn).toBe(1);
    expect(after.relationships.rel_player_mio!.affection).toBe(32);
    expect(after.relationships.rel_player_mio!.trust).toBe(100);
    expect(after.flags.helped_today).toBe(true);
    expect(before.run.turn).toBe(0);
    expect(before.relationships.rel_player_mio!.trust).toBe(40);
  });
});

describe('diffGameStates', () => {
  it('detects run / relationship / flag changes', () => {
    const before = makeCoreGameState();
    const after = cloneGameState(before);
    after.run.turn = 2;
    after.run.dailyProgress = 3;
    after.relationships.rel_player_mio!.affection = 35;
    after.flags.helped_today = true;

    const diff = diffGameStates(before, after);
    expect(diff.run.map((change) => change.field)).toEqual(
      expect.arrayContaining(['turn', 'dailyProgress']),
    );
    expect(diff.relationships.rel_player_mio?.affection).toEqual({
      before: 30,
      after: 35,
      delta: 5,
    });
    expect(diff.flags.set?.helped_today).toBe(true);
  });
});
