import type {
  STExtensionBridgeConfig,
  STExtensionHandler,
  STExtensionRequest,
  STExtensionResponse,
} from './types.js';

/**
 * SillyTavern Extension 通信协议的最小实现。
 * request { type, requestId?, payload? } → response { type, requestId?, payload?, error? }。
 */
export class STExtensionBridge {
  private readonly handlers = new Map<string, STExtensionHandler>();
  private readonly prefix: string;

  constructor(config: STExtensionBridgeConfig = {}) {
    this.prefix = config.prefix ?? 'ag.';
  }

  register(type: string, handler: STExtensionHandler): void {
    this.handlers.set(type, handler);
  }

  unregister(type: string): void {
    this.handlers.delete(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  async handle(request: STExtensionRequest): Promise<STExtensionResponse> {
    const handler = this.handlers.get(request.type);
    if (!handler) {
      return {
        type: request.type,
        requestId: request.requestId,
        error: `Unknown extension request type: ${request.type}`,
      };
    }
    try {
      return {
        type: request.type,
        requestId: request.requestId,
        payload: await handler(request.payload),
      };
    } catch (error) {
      return {
        type: request.type,
        requestId: request.requestId,
        error: String(error),
      };
    }
  }

  /** 创建标准 ST extension 命令：ag.getState / ag.getContext / ag.health。 */
  installStandardHandlers(getState: () => unknown, getContext: () => unknown): void {
    this.register(`${this.prefix}getState`, () => getState());
    this.register(`${this.prefix}getContext`, () => getContext());
    this.register(`${this.prefix}health`, () => ({ ok: true }));
  }
}
