import { describe, expect, it } from 'vitest';
import { LLMError, type LLMGateway } from './llm-port.js';
import { TestProvider } from './test-provider.js';

describe('LLM Port and TestProvider', () => {
  it('records requests and returns fixture responses', async () => {
    const provider = TestProvider.fromText('first', 'second');
    const gateway: LLMGateway = provider;
    expect(await gateway.generate({ messages: [{ role: 'user', content: 'a' }] })).toEqual({
      text: 'first',
    });
    expect(await gateway.generate({ messages: [{ role: 'user', content: 'b' }] })).toEqual({
      text: 'second',
    });
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]?.messages[0]?.content).toBe('a');
  });

  it('propagates provider failures for retry testing', async () => {
    const provider = new TestProvider((_request, callIndex) => {
      if (callIndex === 0) throw new LLMError('timeout', 'timeout');
      return { text: 'ok' };
    });
    await expect(provider.generate({ messages: [] })).rejects.toThrow('timeout');
    expect(await provider.generate({ messages: [] })).toEqual({ text: 'ok' });
  });
});
