import { z } from 'zod';
import {
  idSchema,
  optionBehaviorSchema,
  llmOptionConditionsSchema,
  optionEffectsSchema,
  optionGameplaySchema,
  optionGenerationSchema,
  optionPresentationSchema,
  type ModelContext,
  type Option,
} from '@ag/schemas';
import { planDiverseOptions, renderOptions, validateOptions, type PlannedOption } from '@ag/option';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { parseStructuredResponse } from './structured-parser.js';

export const plannedOptionSchema = z
  .object({
    id: idSchema,
    presentation: optionPresentationSchema,
    behavior: optionBehaviorSchema,
    gameplay: optionGameplaySchema,
    effects: optionEffectsSchema,
    conditions: llmOptionConditionsSchema,
    generation: optionGenerationSchema,
  })
  .strict();

export interface LLMOptionPlannerOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
  minOptions?: number;
}

export interface OptionPlanningResult {
  options: Option[];
  source: 'llm' | 'fallback';
}

/**
 * 06/07 Option Planning + Realization。
 * 先尝试让 LLM 输出结构化 Option Plans，再渲染为自然语言 Option；
 * 非法输出 Retry，仍失败则回退确定性四类规划。
 */
export async function planAndRenderOptions(
  context: ModelContext,
  gateway: LLMGateway,
  options: LLMOptionPlannerOptions = {},
): Promise<OptionPlanningResult> {
  const maxAttempts = options.maxAttempts ?? 1;
  const minOptions = options.minOptions ?? 4;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildOptionRequest(context, options));
      const plans = parseStructuredResponse(response.text, z.array(plannedOptionSchema));
      const rendered = renderOptions(plans);
      if (
        rendered.length >= minOptions &&
        validateOptions(rendered, { gameState: context.currentState }).valid
      ) {
        return { options: rendered, source: 'llm' };
      }
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
      // Retry; final fallback below.
    }
  }

  const fallbackPlans: PlannedOption[] = planDiverseOptions(Math.max(minOptions, 4));
  return { options: renderOptions(fallbackPlans), source: 'fallback' };
}

function buildOptionRequest(context: ModelContext, options: LLMOptionPlannerOptions): LLMRequest {
  return {
    model: options.model,
    temperature: 0.7,
    maxTokens: 768,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `为 Day ${context.day} ${context.time} 的场景生成至少 4 个行为选项。`,
          '必须覆盖：主动行为 / 保守行为 / 社交关系行为 / 风险行为。',
          '输出 JSON 数组，元素结构（presentation 必须是玩家可读的自然语言）：',
          'conditions 只允许输出 {}，或 {"<flag>": boolean|number|"字符串"}；不要输出数组、null 或嵌套对象。',
          '{"id":"option_001","presentation":{"text":"需要我帮忙吗？","tone":"supportive"},"behavior":{"actions":["support"],"intent":["care"],"risk":0.15},"gameplay":{"progress":2},"effects":{"affection":{"base":2}},"conditions":{},"generation":{"must_fit_character":true,"must_fit_context":true,"variation":"high"}}',
        ].join('\n'),
      },
    ],
  };
}
