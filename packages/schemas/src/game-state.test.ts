import { describe, expect, it } from 'vitest';
import { gameStateSchema, runStateSchema } from './game-state.js';
import { makeGameState } from './test-data.js';

describe('GameState schema', () => {
  it('accepts a complete valid GameState', () => {
    expect(gameStateSchema.safeParse(makeGameState()).success).toBe(true);
  });

  it('rejects wrong schemaVersion', () => {
    const state = makeGameState();
    state.schemaVersion = '0.0.9' as never;
    expect(gameStateSchema.safeParse(state).success).toBe(false);
  });

  it('rejects day 0, negative daily progress, and invalid run status', () => {
    const state = makeGameState();

    state.run.day = 0;
    expect(runStateSchema.safeParse(state.run).success).toBe(false);
    expect(gameStateSchema.safeParse(state).success).toBe(false);

    state.run.day = 1;
    state.run.dailyProgress = -1;
    expect(runStateSchema.safeParse(state.run).success).toBe(false);
    expect(gameStateSchema.safeParse(state).success).toBe(false);

    state.run.dailyProgress = 0;
    state.run.status = 'crashed' as never;
    expect(runStateSchema.safeParse(state.run).success).toBe(false);
  });

  it('rejects character records with missing identity fields', () => {
    const state = makeGameState();
    delete (state.characters.char_mio as { identity?: unknown }).identity;
    expect(gameStateSchema.safeParse(state).success).toBe(false);
  });
});
