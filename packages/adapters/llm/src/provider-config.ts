export type LLMProviderKind = 'openai' | 'anthropic' | 'openai-compatible';

export interface LLMProviderConfig {
  kind: LLMProviderKind;
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
  /** USD per 1K input/output tokens；缺省 0，只计数不算成本。 */
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 2;

export function normalizeProviderConfig(
  config: Omit<LLMProviderConfig, 'kind'> & { kind: LLMProviderKind },
): LLMProviderConfig {
  if (!config.model.trim()) throw new Error('LLM provider model is required');
  if (!config.apiKey.trim()) throw new Error('LLM provider apiKey is required');
  return {
    ...config,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
  };
}
