import type {
  OptionBehavior,
  OptionEffects,
  OptionGameplay,
  OptionGeneration,
  OptionPresentation,
} from '@ag/schemas';

/** Option Planning 的中间产物：只有逻辑，没有 surface language。 */
export interface PlannedOption {
  id: string;
  /** LLM Realization 可选产物；缺省时 renderer 使用机械 fallback 文本。 */
  presentation?: OptionPresentation;
  behavior: OptionBehavior;
  gameplay: OptionGameplay;
  effects: OptionEffects;
  /** LLM 可输出宽松条件；renderOption 会 sanitize 为严格 OptionConditions。 */
  conditions: Record<string, unknown>;
  generation: OptionGeneration;
}

export const DIVERSITY_TEMPLATES: readonly PlannedOption[] = [
  {
    id: 'option_active_1',
    behavior: {
      actions: ['approach', 'support'],
      intent: ['care'],
      risk: 0.15,
    },
    gameplay: { progress: 2 },
    effects: { affection: { base: 2 }, trust: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
  {
    id: 'option_conservative_1',
    behavior: {
      actions: ['observe', 'wait'],
      intent: ['respect'],
      risk: 0.05,
    },
    gameplay: { progress: 0 },
    effects: { trust: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
  },
  {
    id: 'option_social_1',
    behavior: {
      actions: ['chat', 'ask'],
      intent: ['connect'],
      risk: 0.1,
    },
    gameplay: { progress: 1 },
    effects: { familiarity: { base: 2 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
  {
    id: 'option_risk_1',
    behavior: {
      actions: ['challenge', 'confess'],
      intent: ['romance'],
      risk: 0.45,
    },
    gameplay: { progress: 2 },
    effects: { affection: { base: 3 }, conflict: { base: 1 } },
    conditions: {},
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  },
];

/**
 * 确定性 Option Planner fallback：
 * 每轮至少覆盖 主动 / 保守 / 社交关系 / 风险 四类。
 */
export function planDiverseOptions(count = 4): PlannedOption[] {
  if (count < 1) throw new Error('Option count must be >= 1');
  return Array.from({ length: count }, (_, index) => {
    const template = DIVERSITY_TEMPLATES[index % DIVERSITY_TEMPLATES.length]!;
    const suffix = Math.floor(index / DIVERSITY_TEMPLATES.length) + 1;
    return {
      ...structuredClone(template),
      id: `${template.id}${suffix > 1 ? `_${suffix}` : ''}`,
    };
  });
}
