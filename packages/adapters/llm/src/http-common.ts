import { LLMError, type LLMErrorCode, type LLMRequest, type LLMResponse } from './llm-port.js';
import { calculateUsageCost, type TokenUsageRecord, type UsageListener } from './cost.js';
import type { LLMProviderConfig } from './provider-config.js';

export type FetchLike = typeof fetch;

export interface HttpCallOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

export async function postJson(options: HttpCallOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    return await fetchImpl(options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LLMError('timeout', `LLM request timed out after ${options.timeoutMs}ms`, {
        retryable: true,
        cause: error,
      });
    }
    throw new LLMError('network_error', `LLM network error: ${String(error)}`, {
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LLMError(
      'invalid_response',
      `LLM provider returned non-JSON response: ${text.slice(0, 200)}`,
      {
        retryable: false,
        cause: error,
      },
    );
  }
}

export function classifyHttpError(response: Response, bodyText?: string): LLMError {
  const status = response.status;
  const snippet = bodyText?.slice(0, 200) ?? '';
  const codes: Array<[number, LLMErrorCode, boolean, string]> = [
    [401, 'auth_error', false, 'authentication failed'],
    [403, 'auth_error', false, 'forbidden'],
    [408, 'timeout', true, 'provider timeout'],
    [429, 'rate_limit', true, 'rate limited'],
    [500, 'provider_error', true, 'provider server error'],
    [502, 'provider_error', true, 'bad gateway'],
    [503, 'provider_error', true, 'provider unavailable'],
    [504, 'timeout', true, 'gateway timeout'],
  ];
  const match = codes.find(([code]) => code === status);
  if (match) {
    return new LLMError(match[1], `${match[3]}: ${snippet}`, { retryable: match[2] });
  }
  if (status >= 500) {
    return new LLMError('provider_error', `provider error ${status}: ${snippet}`, {
      retryable: true,
    });
  }
  if (status >= 400) {
    return new LLMError('invalid_request', `provider rejected request (${status}): ${snippet}`, {
      retryable: false,
    });
  }
  return new LLMError('invalid_response', `unexpected HTTP status ${status}: ${snippet}`, {
    retryable: false,
  });
}

export interface UsageRecordOptions {
  config: LLMProviderConfig;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  listener?: UsageListener;
}

export function recordUsage(options: UsageRecordOptions): TokenUsageRecord | undefined {
  const usage = {
    promptTokens: options.promptTokens ?? 0,
    completionTokens: options.completionTokens ?? 0,
    totalTokens: (options.promptTokens ?? 0) + (options.completionTokens ?? 0),
  };
  const costs = calculateUsageCost(
    usage,
    options.config.costPerInputToken,
    options.config.costPerOutputToken,
  );
  const record: TokenUsageRecord = {
    timestamp: new Date().toISOString(),
    model: options.model,
    usage,
    durationMs: options.durationMs,
    ...costs,
  };
  options.listener?.onUsage(record);
  return record;
}

export interface AdapterDeps {
  fetchImpl?: FetchLike;
  usageListener?: UsageListener;
}

export function assertTextResponse(response: LLMResponse): string {
  if (typeof response.text !== 'string' || response.text.length === 0) {
    throw new LLMError('invalid_response', 'LLM provider returned empty text', {
      retryable: false,
    });
  }
  return response.text;
}

export type { LLMRequest };
