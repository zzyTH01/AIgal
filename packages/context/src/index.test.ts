import { describe, expect, it } from 'vitest';
import { allocateContextBudget } from './index.js';

describe('@ag/context package entry', () => {
  it('exports a working budget allocator', () => {
    expect(allocateContextBudget(80).memories).toBe(20);
  });
});
