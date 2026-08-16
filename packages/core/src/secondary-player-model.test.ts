import { describe, expect, it } from 'vitest';
import { resolveSecondaryDelta } from './secondary-resolution.js';
import { updatePlayerModelFromTurn } from './player-model-update.js';
import { makeCoreGameState, supportOption } from './test-data.js';

describe('Secondary State Resolution + Player Model Update', () => {
  it('maps positive reaction emotion/intent into character psychology/emotion delta', () => {
    const state = makeCoreGameState();
    const delta = resolveSecondaryDelta(state, supportOption, {
      emotion: { type: 'relief', intensity: 70 },
      intent: { type: 'seek_closeness', intensity: 50 },
    });
    const characterDelta = delta.characters?.char_mio;
    expect(characterDelta?.psychology?.stress?.delta).toBeLessThan(0);
    expect(characterDelta?.psychology?.loneliness?.delta).toBeLessThan(0);
    expect(characterDelta?.emotion?.valence?.delta).toBeGreaterThan(0);
  });

  it('updates subjective player model based on behavior and reaction', () => {
    const state = makeCoreGameState();
    const next = updatePlayerModelFromTurn(state, supportOption, {
      emotion: { type: 'relief', intensity: 70 },
    });
    expect(next.playerModel.caring).toBeGreaterThan(state.playerModel.caring);
    expect(next.playerModel.reliability).toBeGreaterThan(state.playerModel.reliability);
    expect(next.playerModel.perceivedIntentions.care).toBeGreaterThanOrEqual(50);
  });
});
