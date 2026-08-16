import { describe, expect, it } from 'vitest';
import { definitionToWorldBook, worldBookToEntries } from './world-book.js';
import { makeDefinition } from './test-data.js';

describe('World Book generation', () => {
  it('creates constant identity/boundary entries and dynamic secret/goal entries', () => {
    const book = definitionToWorldBook(makeDefinition());
    const entries = worldBookToEntries(book);
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries.some((entry) => entry.keys.includes('Mio') && entry.constant)).toBe(true);
    expect(entries.some((entry) => entry.keys.includes('secret'))).toBe(true);
    expect(entries.some((entry) => entry.keys.includes('goal'))).toBe(true);
  });
});
