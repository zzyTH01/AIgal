import { z } from 'zod';
import type { ModelContext } from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { planDiverseOptions, renderOptions, validateOptions, type PlannedOption } from '@ag/option';
import { generatedScenarioSchema, type GeneratedScenario } from './scenario.js';
import { plannedOptionSchema } from './option-planner.js';
import { parseStructuredResponse } from './structured-parser.js';
import { fallbackScenario } from './scenario-generator.js';

export const combinedGenerationSchema = z
  .object({
    scenario: generatedScenarioSchema,
    options: z.array(plannedOptionSchema).min(1),
  })
  .strict();

export interface CombinedGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
  minOptions?: number;
}

export interface ScenarioOptionsResult {
  scenario: GeneratedScenario;
  options: Awaited<ReturnType<typeof renderOptions>>;
  source: 'llm' | 'fallback';
}

/**
 * LLM Call Minimization：Scenario + Options 合并为 1 次调用。
 * Phase 7 起 `runNarrativeTurn` 使用本函数，Turn 从 3 次降为 2 次。
 */
export async function generateScenarioAndOptions(
  context: ModelContext,
  gateway: LLMGateway,
  options: CombinedGeneratorOptions = {},
): Promise<ScenarioOptionsResult> {
  const maxAttempts = options.maxAttempts ?? 1;
  const minOptions = options.minOptions ?? 4;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildCombinedRequest(context, options));
      const parsed = parseStructuredResponse(response.text, combinedGenerationSchema);
      const rendered = renderOptions(parsed.options);
      if (
        rendered.length >= minOptions &&
        validateOptions(rendered, { gameState: context.currentState }).valid
      ) {
        return { scenario: parsed.scenario, options: rendered, source: 'llm' };
      }
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
    }
  }

  const fallbackPlans: PlannedOption[] = planDiverseOptions(Math.max(minOptions, 4));
  return {
    scenario: fallbackScenario(context),
    options: renderOptions(fallbackPlans),
    source: 'fallback',
  };
}

function buildCombinedRequest(
  context: ModelContext,
  options: CombinedGeneratorOptions,
): LLMRequest {
  return {
    model: options.model,
    temperature: 0.8,
    maxTokens: 1024,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `Day ${context.day} ${context.time}，生成当前场景和 4 个行为选项。`,
          '必须覆盖：主动 / 保守 / 社交关系 / 风险。',
          '严格输出 JSON：',
          '{"scenario":{"narrative":"场景文本","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0}}},"options":[{"id":"option_001","presentation":{"text":"自然语言选项","tone":"..."},"behavior":{"actions":["support"],"intent":["care"],"risk":0.15},"gameplay":{"progress":2},"effects":{"affection":{"base":2}},"conditions":{},"generation":{"must_fit_character":true,"must_fit_context":true,"variation":"high"}}]}',
        ].join('\n'),
      },
    ],
  };
}
