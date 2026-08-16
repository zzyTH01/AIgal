import type { ModelContext } from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { generatedScenarioSchema, type GeneratedScenario } from './scenario.js';
import { parseStructuredResponse } from './structured-parser.js';

export interface ScenarioGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
}

/** 05 Scenario Generation：输入 ModelContext，输出自然语言 + 情绪/意图结构化。 */
export async function generateScenario(
  context: ModelContext,
  gateway: LLMGateway,
  options: ScenarioGeneratorOptions = {},
): Promise<GeneratedScenario & { source: 'llm' | 'fallback' }> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildScenarioRequest(context, options));
      return { ...parseStructuredResponse(response.text, generatedScenarioSchema), source: 'llm' };
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
      // Retry; final fallback below.
    }
  }

  return { ...fallbackScenario(context), source: 'fallback' };
}

function buildScenarioRequest(
  context: ModelContext,
  options: ScenarioGeneratorOptions,
): LLMRequest {
  const characterSummary = Object.values(context.currentState.characters)
    .map((character) => `${character.identity.name}(${character.identity.role})`)
    .join('、');
  const eventText = context.currentEvent
    ? `当前事件：${context.currentEvent.title} / ${context.currentEvent.description}`
    : '当前无特定事件。';

  return {
    model: options.model,
    temperature: 0.8,
    maxTokens: 512,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          eventText,
          `当前状态：Day ${context.day} ${context.time}，地点 ${context.currentState.world.currentLocationId}。`,
          `在场角色：${characterSummary || '无'}。`,
          '请生成当前场景，并严格输出 JSON：',
          '{"narrative":"场景文本","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0}}}',
        ].join('\n'),
      },
    ],
  };
}

function fallbackScenario(context: ModelContext): GeneratedScenario {
  const character = Object.values(context.currentState.characters)[0];
  return {
    narrative: '（场景生成回退）你来到了当前地点，周围安静下来。',
    structured: character
      ? {
          emotion: { type: character.emotion.primary, intensity: character.emotion.intensity },
        }
      : {},
  };
}
