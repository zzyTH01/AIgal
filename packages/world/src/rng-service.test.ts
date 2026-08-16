import { describe, expect, it } from 'vitest';
import { rngStateSchema } from '@ag/schemas';
import { XorShift128Rng, createSeededRng } from './rng-service.js';

describe('XorShift128Rng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1) and different seeds differ', () => {
    const rng = createSeededRng(7);
    const other = createSeededRng(8);
    const values = Array.from({ length: 100 }, () => rng.next());
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(values).not.toEqual(Array.from({ length: 100 }, () => other.next()));
  });

  it('save/restore preserves replay state', () => {
    const rng = createSeededRng(99);
    Array.from({ length: 20 }, () => rng.next());
    const saved = rng.save();
    expect(rngStateSchema.safeParse(saved).success).toBe(true);
    expect(saved.seed).toBe(99);

    const restored = XorShift128Rng.fromState(saved);
    expect(Array.from({ length: 50 }, () => rng.next())).toEqual(
      Array.from({ length: 50 }, () => restored.next()),
    );
  });

  it('supports integer ranges', () => {
    const rng = createSeededRng(1);
    for (let index = 0; index < 100; index += 1) {
      const value = rng.nextInt(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThan(5);
    }
  });
});
