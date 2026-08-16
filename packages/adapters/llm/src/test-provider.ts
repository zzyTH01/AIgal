import type { LLMGateway, LLMRequest, LLMResponse } from './llm-port.js';

export type TestProviderFactory = (
  request: LLMRequest,
  callIndex: number,
) => LLMResponse | Promise<LLMResponse>;

/**
 * Fixture 驱动的 TestProvider。
 * - 每次 generate 都会记录 request
 * - 返回工厂结果；工厂抛错则原样向上传播，用于测试 Retry 路径
 */
export class TestProvider implements LLMGateway {
  readonly calls: LLMRequest[] = [];

  constructor(private readonly factory: TestProviderFactory) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const callIndex = this.calls.length;
    this.calls.push(request);
    return this.factory(request, callIndex);
  }

  static fromResponses(...responses: LLMResponse[]): TestProvider {
    return new TestProvider((_request, callIndex) => {
      const response = responses[callIndex];
      if (!response) {
        throw new Error(`No fixture response for call ${callIndex}`);
      }
      return response;
    });
  }

  static fromText(...texts: string[]): TestProvider {
    return TestProvider.fromResponses(...texts.map((text) => ({ text })));
  }
}
