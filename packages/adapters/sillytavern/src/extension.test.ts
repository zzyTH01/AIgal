import { describe, expect, it } from 'vitest';
import { STExtensionBridge } from './extension.js';

describe('ST Extension protocol bridge', () => {
  it('dispatches requests and returns payloads', async () => {
    const bridge = new STExtensionBridge({ prefix: 'ag.' });
    bridge.register('ag.test', (payload) => ({ echo: payload }));
    expect(await bridge.handle({ type: 'ag.test', payload: 42, requestId: 'r1' })).toEqual({
      type: 'ag.test',
      requestId: 'r1',
      payload: { echo: 42 },
    });
  });

  it('returns typed errors for unknown/throw handlers', async () => {
    const bridge = new STExtensionBridge();
    expect(await bridge.handle({ type: 'missing' })).toMatchObject({
      error: expect.stringContaining('Unknown'),
    });
    bridge.register('boom', () => {
      throw new Error('boom');
    });
    expect(await bridge.handle({ type: 'boom' })).toMatchObject({ error: 'Error: boom' });
  });
});
