import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('@ag/core placeholder', () => {
  it('声明包身份', () => {
    expect(PACKAGE_NAME).toBe('@ag/core');
  });
});
