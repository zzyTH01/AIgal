import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './index.js';

describe('@ag/schemas placeholder', () => {
  it('暴露 Schema 版本', () => {
    expect(SCHEMA_VERSION).toBe('0.1.0');
  });
});
