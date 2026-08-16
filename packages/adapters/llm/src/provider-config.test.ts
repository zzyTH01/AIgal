import { describe, expect, it } from 'vitest';
import { loadProviderConfigFromEnv, normalizeProviderConfig } from './provider-config.js';

describe('provider config', () => {
  it('allows OpenAI-compatible providers without apiKey', () => {
    expect(() =>
      normalizeProviderConfig({ kind: 'openai-compatible', apiKey: '', model: 'local' }),
    ).not.toThrow();
    expect(() => normalizeProviderConfig({ kind: 'openai', apiKey: '', model: 'm' })).toThrow(
      /apiKey/,
    );
  });

  it('loads config from env with defaults and numeric parsing', () => {
    const config = loadProviderConfigFromEnv({
      LLM_PROVIDER: 'anthropic',
      LLM_API_KEY: 'env-key',
      LLM_MODEL: 'claude-test',
      LLM_BASE_URL: 'http://localhost:9999',
      LLM_TIMEOUT_MS: '1234',
      LLM_MAX_RETRIES: '3',
      LLM_COST_INPUT_PER_1K: '0.001',
    });
    expect(config.kind).toBe('anthropic');
    expect(config.apiKey).toBe('env-key');
    expect(config.model).toBe('claude-test');
    expect(config.timeoutMs).toBe(1234);
    expect(config.maxRetries).toBe(3);
    expect(config.costPerInputToken).toBe(0.001);
  });
});
