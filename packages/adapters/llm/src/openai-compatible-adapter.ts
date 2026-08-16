import { OpenAIAdapter } from './openai-adapter.js';
import type { LLMProviderConfig } from './provider-config.js';
import type { AdapterDeps } from './http-common.js';

/** Local 模型作为 OpenAI-compatible 变体预留；baseUrl 必须显式配置。 */
export class OpenAICompatibleAdapter extends OpenAIAdapter {
  constructor(config: Omit<LLMProviderConfig, 'kind'>, deps: AdapterDeps = {}) {
    if (!config.baseUrl?.trim()) {
      throw new Error('OpenAICompatibleAdapter requires baseUrl');
    }
    super(config, deps);
  }
}
