import { describe, expect, it } from 'vitest';
import { createSeededRng } from './index.js';

describe('@ag/world package entry', () => {
  it('exports a working seeded RNG', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(1);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(
      Array.from({ length: 10 }, () => b.next()),
    );
  });
});
