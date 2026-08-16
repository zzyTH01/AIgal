import { describe, expect, it } from 'vitest';
import { ContextCache } from './cache.js';
import { makeContextGameState } from './test-data.js';

describe('ContextCache', () => {
  it('caches stable system rules and summaries with hit stats', () => {
    const cache = new ContextCache();
    const state = makeContextGameState();
    const first = cache.getSystemRules('char_mio', () => 'stable rules');
    const second = cache.getSystemRules('char_mio', () => 'should not run');
    expect(first).toBe('stable rules');
    expect(second).toBe('stable rules');
    expect(cache.getStats()).toEqual({ hits: 1, misses: 1 });

    cache.getStableSummary(state, 'char_mio');
    cache.getStableSummary(state, 'char_mio');
    expect(cache.getStats().hits).toBe(2);
  });
});
