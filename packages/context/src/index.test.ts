import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('@ag/context placeholder', () => {
  it('声明包身份', () => {
    expect(PACKAGE_NAME).toBe('@ag/context');
  });
});
