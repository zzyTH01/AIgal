import { optionSchema, type Option, type OptionConditions } from '@ag/schemas';
import type { PlannedOption } from './planner.js';

export interface RenderOptionOptions {
  text?: string;
  tone?: string;
}

/** 把 Planning 产物转成玩家可见的 Behavior Object。 */
export function renderOption(plan: PlannedOption, options: RenderOptionOptions = {}): Option {
  const presentation = plan.presentation ?? {
    text:
      options.text ??
      `${plan.behavior.actions.join(' / ')}（${options.tone ?? plan.behavior.actions[0] ?? 'neutral'}）`,
    tone: options.tone ?? plan.behavior.actions[0] ?? 'neutral',
  };
  return optionSchema.parse({
    id: plan.id,
    presentation,
    behavior: plan.behavior,
    gameplay: plan.gameplay,
    effects: plan.effects,
    conditions: sanitizeOptionConditions(plan.conditions),
    generation: plan.generation,
  });
}

/** 宽松 LLM conditions → 严格 OptionConditions；无法映射的值直接丢弃。 */
export function sanitizeOptionConditions(conditions: Record<string, unknown>): OptionConditions {
  const sanitized: OptionConditions = {};
  for (const [key, value] of Object.entries(conditions)) {
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      sanitized[key] = value;
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const min = typeof record.min === 'number' ? record.min : undefined;
      const max = typeof record.max === 'number' ? record.max : undefined;
      if (min !== undefined || max !== undefined) {
        sanitized[key] = {
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
        };
      }
    }
  }
  return sanitized;
}

export function renderOptions(
  plans: readonly PlannedOption[],
  options: RenderOptionOptions = {},
): Option[] {
  return plans.map((plan) => renderOption(plan, options));
}
