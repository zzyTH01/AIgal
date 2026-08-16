import { describe, expect, it } from 'vitest';
import { validateGameState } from '@ag/core';
import { defaultWorldTick, tickWorld } from './world-tick.js';
import { makeWorldGameState } from './test-data.js';

describe('WorldTick', () => {
  it('syncs authoritative run fields into world without mutating input', () => {
    const state = makeWorldGameState();
    state.run.day = 2;
    state.run.time = '10:30';
    state.run.currentLocationId = 'loc_library';
    const next = tickWorld(state);

    expect(next.world.day).toBe(2);
    expect(next.world.time).toBe('10:30');
    expect(next.world.currentLocationId).toBe('loc_library');
    expect(state.world.day).toBe(1);
    expect(validateGameState(next).success).toBe(true);
  });

  it('defaultWorldTick guards against invalid output', () => {
    const state = makeWorldGameState();
    expect(validateGameState(defaultWorldTick.tick(state)).success).toBe(true);
  });
});
