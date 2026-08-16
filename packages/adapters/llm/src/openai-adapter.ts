import type { LLMGateway, LLMRequest, LLMResponse } from './llm-port.js';
import { executeWithRetry } from './retry.js';
import { normalizeProviderConfig, type LLMProviderConfig } from './provider-config.js';
import {
  classifyHttpError,
  postJson,
  readJsonResponse,
  recordUsage,
  type AdapterDeps,
} from './http-common.js';

export class OpenAIAdapter implements LLMGateway {
  readonly config: LLMProviderConfig;
  private readonly fetchImpl?: AdapterDeps['fetchImpl'];
  private readonly usageListener?: AdapterDeps['usageListener'];

  constructor(config: Omit<LLMProviderConfig, 'kind'>, deps: AdapterDeps = {}) {
    this.config = normalizeProviderConfig({ ...config, kind: 'openai' });
    this.fetchImpl = deps.fetchImpl;
    this.usageListener = deps.usageListener;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return executeWithRetry(() => this.generateOnce(request), {
      maxRetries: this.config.maxRetries ?? 2,
    });
  }

  private async generateOnce(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const started = Date.now();
    const body = {
      model: request.model ?? this.config.model,
      messages: request.messages,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
    };

    const response = await postJson({
      url: `${baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${this.config.apiKey}` },
      body,
      timeoutMs: this.config.timeoutMs ?? 30_000,
      fetchImpl: this.fetchImpl,
    });

    if (!response.ok) {
      const text = await response.text();
      throw classifyHttpError(response, text);
    }

    const json = (await readJsonResponse(response)) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw classifyHttpError(response, JSON.stringify(json));
    }

    const result: LLMResponse = {
      text: content,
      raw: json,
      model: request.model ?? this.config.model,
      finishReason: json.choices?.[0]?.finish_reason,
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens,
      },
    };

    recordUsage({
      config: this.config,
      model: result.model ?? 'unknown',
      durationMs: Date.now() - started,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      listener: this.usageListener,
    });

    return result;
  }
}
