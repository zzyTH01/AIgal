export type LLMMessageRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * 所有 Narrative 生成只依赖本 Port；真实 Provider 在 Phase 7 落地。
 * 结构化输出约束由调用方在 responseSchema / prompt 中声明。
 */
export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseSchema?: unknown;
}

export interface LLMResponse {
  /** Natural Language 通道（也可能是包含 JSON 的文本，由调用方解析）。 */
  text: string;
  raw?: unknown;
  model?: string;
  finishReason?: string;
  usage?: LLMUsage;
}

export interface LLMGateway {
  generate(request: LLMRequest): Promise<LLMResponse>;
}

export type LLMErrorCode =
  | 'parse_error'
  | 'rate_limit'
  | 'timeout'
  | 'refusal'
  | 'provider_error'
  | 'invalid_response'
  | 'invalid_request'
  | 'network_error'
  | 'auth_error';

export class LLMError extends Error {
  override readonly name: string = 'LLMError';
  readonly code: LLMErrorCode;
  readonly retryable: boolean;
  readonly request?: LLMRequest;
  override readonly cause?: unknown;

  constructor(
    code: LLMErrorCode,
    message: string,
    options: { retryable?: boolean; request?: LLMRequest; cause?: unknown } = {},
  ) {
    super(message);
    this.code = code;
    this.retryable = options.retryable ?? true;
    this.request = options.request;
    this.cause = options.cause;
  }
}
