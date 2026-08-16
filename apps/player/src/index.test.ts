import { describe, expect, it } from 'vitest';
import { createPlayerApi } from './index.js';

describe('@ag/player package entry', () => {
  it('exports a player API client', async () => {
    const api = createPlayerApi();
    const started = await api.start();
    expect(started.ok).toBe(true);
  });
});
