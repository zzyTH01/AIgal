import { describe, expect, it } from 'vitest';
import { runGoldenTurn } from './golden-test.js';

describe('Golden Test (RNG + GameState + LLM Fixture)', () => {
  it('produces identical fingerprints for the same seed and fixture', async () => {
    const a = await runGoldenTurn(42);
    const b = await runGoldenTurn(42);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.optionIds).toHaveLength(4);
    expect(a.reactionText.length).toBeGreaterThan(0);
  });
});
