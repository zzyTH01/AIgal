import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('@ag/option placeholder', () => {
  it('声明包身份', () => {
    expect(PACKAGE_NAME).toBe('@ag/option');
  });
});
