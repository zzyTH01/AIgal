import { LLMError, type LLMGateway, type LLMRequest, type LLMResponse } from './llm-port.js';
import { executeWithRetry } from './retry.js';
import { normalizeProviderConfig, type LLMProviderConfig } from './provider-config.js';
import {
  classifyHttpError,
  postJson,
  readJsonResponse,
  recordUsage,
  type AdapterDeps,
} from './http-common.js';

export class AnthropicAdapter implements LLMGateway {
  readonly config: LLMProviderConfig;
  private readonly fetchImpl?: AdapterDeps['fetchImpl'];
  private readonly usageListener?: AdapterDeps['usageListener'];

  constructor(config: Omit<LLMProviderConfig, 'kind'>, deps: AdapterDeps = {}) {
    this.config = normalizeProviderConfig({ ...config, kind: 'anthropic' });
    this.fetchImpl = deps.fetchImpl;
    this.usageListener = deps.usageListener;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    return executeWithRetry(() => this.generateOnce(request), {
      maxRetries: this.config.maxRetries ?? 2,
    });
  }

  private async generateOnce(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = (this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
    const started = Date.now();
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }));

    const body = {
      model: request.model ?? this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 1024,
      temperature: request.temperature ?? this.config.temperature,
      system,
      messages,
    };

    const response = await postJson({
      url: `${baseUrl}/v1/messages`,
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
      timeoutMs: this.config.timeoutMs ?? 30_000,
      fetchImpl: this.fetchImpl,
    });

    if (!response.ok) {
      const text = await response.text();
      throw classifyHttpError(response, text);
    }

    const json = (await readJsonResponse(response)) as {
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = json.content?.find((block) => block.type === 'text')?.text ?? '';
    if (!content) {
      throw new LLMError('invalid_response', 'Anthropic response contained no text block', {
        retryable: false,
      });
    }

    const result: LLMResponse = {
      text: content,
      raw: json,
      model: request.model ?? this.config.model,
      finishReason: json.stop_reason,
      usage: {
        promptTokens: json.usage?.input_tokens ?? 0,
        completionTokens: json.usage?.output_tokens ?? 0,
        totalTokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
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
