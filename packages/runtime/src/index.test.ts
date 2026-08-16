import { describe, expect, it } from 'vitest';
import { ApplicationApi } from './index.js';

describe('@ag/runtime package entry', () => {
  it('exports ApplicationApi', async () => {
    const api = ApplicationApi.create();
    expect((await api.gameStart()).ok).toBe(true);
  });
});
