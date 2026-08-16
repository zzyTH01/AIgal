import { describe, expect, it } from 'vitest';
import { MemoryStore } from './index.js';
import { makeMemoryGameState } from './test-data.js';

describe('@ag/memory package entry', () => {
  it('exports a working MemoryStore', () => {
    const store = MemoryStore.fromMemoryState(makeMemoryGameState().memories);
    expect(store.activeRecords()).toHaveLength(0);
  });
});
