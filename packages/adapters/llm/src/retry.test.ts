import { describe, expect, it } from 'vitest';
import { executeWithRetry } from './retry.js';
import { LLMError } from './llm-port.js';

describe('executeWithRetry', () => {
  it('does not retry non-LLM programming errors', async () => {
    let calls = 0;
    await expect(
      executeWithRetry(
        async () => {
          calls += 1;
          throw new TypeError('programming bug');
        },
        { maxRetries: 2 },
      ),
    ).rejects.toThrow('programming bug');
    expect(calls).toBe(1);
  });

  it('does retry retryable LLMError', async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new LLMError('timeout', 'timeout');
        return 'ok';
      },
      { maxRetries: 1, baseDelayMs: 0 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});
