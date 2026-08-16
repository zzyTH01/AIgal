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
  // 本地 OpenAI-compatible 端点（Ollama/LocalAI 等）允许无 key。
  if (config.kind !== 'openai-compatible' && !config.apiKey.trim()) {
    throw new Error('LLM provider apiKey is required');
  }
  return {
    ...config,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
  };
}

export function loadProviderConfigFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): LLMProviderConfig {
  const kind = (env.LLM_PROVIDER ?? 'openai') as LLMProviderConfig['kind'];
  const model = env.LLM_MODEL ?? (kind === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini');
  const timeoutMs = env.LLM_TIMEOUT_MS ? Number(env.LLM_TIMEOUT_MS) : undefined;
  const maxRetries = env.LLM_MAX_RETRIES ? Number(env.LLM_MAX_RETRIES) : undefined;
  const costPerInputToken = env.LLM_COST_INPUT_PER_1K
    ? Number(env.LLM_COST_INPUT_PER_1K)
    : undefined;
  const costPerOutputToken = env.LLM_COST_OUTPUT_PER_1K
    ? Number(env.LLM_COST_OUTPUT_PER_1K)
    : undefined;

  if (
    Number.isNaN(timeoutMs) ||
    Number.isNaN(maxRetries) ||
    Number.isNaN(costPerInputToken) ||
    Number.isNaN(costPerOutputToken)
  ) {
    throw new Error('LLM_* numeric environment variables must be valid numbers');
  }

  return normalizeProviderConfig({
    kind,
    apiKey: env.LLM_API_KEY ?? '',
    baseUrl: env.LLM_BASE_URL,
    model,
    timeoutMs,
    maxRetries,
    temperature: env.LLM_TEMPERATURE ? Number(env.LLM_TEMPERATURE) : undefined,
    maxTokens: env.LLM_MAX_TOKENS ? Number(env.LLM_MAX_TOKENS) : undefined,
    costPerInputToken,
    costPerOutputToken,
  });
}
