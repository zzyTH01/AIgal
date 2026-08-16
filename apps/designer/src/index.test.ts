import { describe, expect, it } from 'vitest';
import { createBlankProject } from './index.js';

describe('@ag/designer package entry', () => {
  it('creates a valid blank project', () => {
    expect(createBlankProject().characters).toHaveLength(1);
  });
});
