import { describe, expect, it } from 'vitest';
import { MemorySaveRepository } from './index.js';

describe('@ag/persistence package entry', () => {
  it('exports MemorySaveRepository', async () => {
    const repo = new MemorySaveRepository();
    await repo.save('x', 1);
    expect(await repo.load('x')).toBe(1);
  });
});
