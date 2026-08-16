import { describe, expect, it } from 'vitest';
import { applyEnding, checkEnding, endingRunStatus, selectEnding } from './ending-engine.js';
import { makeCoreGameState, makeEndings } from './test-data.js';

describe('EndingEngine', () => {
  it('selects the highest-priority satisfied ending', () => {
    const state = makeCoreGameState();
    const endings = makeEndings();
    expect(selectEnding(state, endings)?.endingId).toBeUndefined();

    state.run.day = 3;
    expect(selectEnding(state, endings)?.endingId).toBe('ending_normal');

    state.relationships.rel_player_mio!.affection = 70;
    state.relationships.rel_player_mio!.trust = 70;
    expect(selectEnding(state, endings)?.endingId).toBe('ending_good');

    state.relationships.rel_player_mio!.trust = 5;
    expect(selectEnding(state, endings)?.endingId).toBe('ending_bad');
  });

  it('marks Good/Normal/Bad run status and records discovered ending', () => {
    const state = makeCoreGameState();
    const bad = makeEndings().find((ending) => ending.kind === 'bad')!;
    const after = applyEnding(state, bad);
    expect(after.run.status).toBe('bad_end');
    expect(after.meta.endingsDiscovered).toContain(bad.endingId);
    expect(endingRunStatus('good')).toBe('completed');
    expect(checkEnding(state, [bad])?.triggered).toBeUndefined();
  });
});
