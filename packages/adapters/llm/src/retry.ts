import { LLMError } from './llm-port.js';

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** 仅 retryable LLMError 或未知网络错误会重试。 */
  retryable?: boolean;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
): Promise<T> {
  const maxRetries = policy.maxRetries ?? 0;
  const baseDelayMs = policy.baseDelayMs ?? 300;
  const maxDelayMs = policy.maxDelayMs ?? 5_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof LLMError ? error.retryable : true; // fetch/network errors are transient by default
      if (attempt >= maxRetries || !retryable) {
        throw error;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
