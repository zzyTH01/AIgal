import { optionSchema, type Option } from '@ag/schemas';
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
    conditions: plan.conditions,
    generation: plan.generation,
  });
}

export function renderOptions(
  plans: readonly PlannedOption[],
  options: RenderOptionOptions = {},
): Option[] {
  return plans.map((plan) => renderOption(plan, options));
}
