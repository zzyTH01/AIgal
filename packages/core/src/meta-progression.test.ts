import { describe, expect, it } from 'vitest';
import { makeCoreGameState, makeEndings } from './test-data.js';
import { applyBadEndPunishment, startNewRunFromMeta } from './meta-progression.js';

describe('Meta progression', () => {
  it('bad end grants knowledge, unlock, archive and permanent modifier', () => {
    const state = makeCoreGameState();
    const bad = makeEndings().find((ending) => ending.kind === 'bad')!;
    const next = applyBadEndPunishment(state, bad);
    expect(next.run.status).toBe('bad_end');
    expect(next.meta.endingsDiscovered).toContain(bad.endingId);
    expect(next.meta.unlocks).toContain(`ending_${bad.endingId}`);
    expect(next.meta.permanentModifiers[`ending_${bad.endingId}`]).toBe(1);
    expect(Object.values(next.meta.knowledge).length).toBeGreaterThan(0);
  });

  it('new run inherits meta and applies permanent starting modifiers', () => {
    const state = makeCoreGameState();
    const bad = makeEndings().find((ending) => ending.kind === 'bad')!;
    const punished = applyBadEndPunishment(state, bad);
    punished.meta.permanentModifiers.starting_affection = 5;
    punished.meta.permanentModifiers.starting_trust = 7;

    const next = startNewRunFromMeta(punished.meta, { runId: 'run_018', seed: 2 });
    expect(next.meta.runCount).toBe(punished.meta.runCount + 1);
    expect(next.meta.endingsDiscovered).toContain(bad.endingId);
    expect(next.relationships.rel_player?.affection).toBe(5);
    expect(next.relationships.rel_player?.trust).toBe(7);
  });
});
