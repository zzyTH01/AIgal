import { describe, expect, it } from 'vitest';
import { createGameState } from './index.js';

describe('@ag/core package entry', () => {
  it('exports a working GameState factory', () => {
    const state = createGameState();
    expect(state.schemaVersion).toBe('0.1.0');
    expect(state.run.day).toBe(1);
  });
});
