import type { LLMGateway } from './llm-port.js';
import type { FetchLike, AdapterDeps } from './http-common.js';
import type { LLMProviderConfig } from './provider-config.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { OpenAICompatibleAdapter } from './openai-compatible-adapter.js';
import { AnthropicAdapter } from './anthropic-adapter.js';

export type GatewayFactory = (config: LLMProviderConfig, deps: AdapterDeps) => LLMGateway;

const factories: Record<LLMProviderConfig['kind'], GatewayFactory> = {
  openai: (config, deps) => new OpenAIAdapter(config, deps),
  anthropic: (config, deps) => new AnthropicAdapter(config, deps),
  'openai-compatible': (config, deps) => new OpenAICompatibleAdapter(config, deps),
};

export function createGateway(
  config: Omit<LLMProviderConfig, 'kind'> & { kind: LLMProviderConfig['kind'] },
  deps: AdapterDeps = {},
): LLMGateway {
  const factory = factories[config.kind];
  if (!factory) {
    throw new Error(`Unknown LLM provider kind: ${String(config.kind)}`);
  }
  return factory(config, deps);
}

export function registerGatewayKind(
  kind: LLMProviderConfig['kind'],
  factory: GatewayFactory,
): void {
  factories[kind] = factory;
}

export function supportedGatewayKinds(): Array<LLMProviderConfig['kind']> {
  return Object.keys(factories) as Array<LLMProviderConfig['kind']>;
}

export type { FetchLike };
