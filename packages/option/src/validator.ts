import { optionSchema, type GameState, type Option } from '@ag/schemas';
import { evaluateConditions, type ConditionSet } from '@ag/core';

export type OptionCategory = 'active' | 'conservative' | 'social' | 'risk';

export interface OptionValidationIssue {
  optionId: string;
  code: string;
  message: string;
}

export interface OptionValidationResult {
  valid: boolean;
  issues: OptionValidationIssue[];
  options: Option[];
}

export interface OptionValidationOptions {
  gameState?: GameState;
  /** 要求四类多样性覆盖。 */
  requireDiversity?: boolean;
  /** 角色一致性：这些行为不被当前角色允许。 */
  forbiddenActions?: string[];
  /** 允许的最大选项数。 */
  maxOptions?: number;
}

const ACTIVE_ACTIONS = ['approach', 'support', 'help', 'protect', 'initiate', 'lead'];
const CONSERVATIVE_ACTIONS = ['observe', 'wait', 'avoid', 'rest', 'withdraw', 'apologize'];
const SOCIAL_ACTIONS = ['chat', 'ask', 'compliment', 'share', 'invite', 'connect'];
const RISK_ACTIONS = ['challenge', 'confess', 'flirt', 'tease', 'provoke', 'conflict'];

export function classifyOption(option: Pick<Option, 'behavior'>): OptionCategory[] {
  const categories = new Set<OptionCategory>();
  for (const action of option.behavior.actions) {
    if (ACTIVE_ACTIONS.includes(action)) categories.add('active');
    if (CONSERVATIVE_ACTIONS.includes(action)) categories.add('conservative');
    if (SOCIAL_ACTIONS.includes(action)) categories.add('social');
    if (RISK_ACTIONS.includes(action)) categories.add('risk');
  }
  return [...categories];
}

export function validateOptions(
  options: readonly Option[],
  validation: OptionValidationOptions = {},
): OptionValidationResult {
  const issues: OptionValidationIssue[] = [];
  const parsedOptions: Option[] = [];
  const seenSignatures = new Set<string>();
  const coveredCategories = new Set<OptionCategory>();

  const maxOptions = validation.maxOptions ?? 6;
  if (options.length > maxOptions) {
    issues.push({
      optionId: 'options',
      code: 'too_many',
      message: `Option count ${options.length} exceeds max ${maxOptions}`,
    });
  }

  for (const option of options) {
    const parsed = optionSchema.safeParse(option);
    if (!parsed.success) {
      issues.push({
        optionId: option.id,
        code: 'schema',
        message: parsed.error.issues.map((issue) => issue.message).join('; '),
      });
      continue;
    }
    const validOption = parsed.data;
    parsedOptions.push(validOption);

    if (validation.gameState) {
      const conditions = validOption.conditions as ConditionSet;
      if (!evaluateConditions(validation.gameState, conditions)) {
        issues.push({
          optionId: validOption.id,
          code: 'condition_unmet',
          message: 'Option conditions are not satisfied by current GameState',
        });
      }
    }

    if (validation.forbiddenActions) {
      const forbidden = validOption.behavior.actions.filter((action) =>
        validation.forbiddenActions!.includes(action),
      );
      if (forbidden.length > 0) {
        issues.push({
          optionId: validOption.id,
          code: 'character_inconsistent',
          message: `Forbidden actions: ${forbidden.join(', ')}`,
        });
      }
    }

    const signature = validOption.behavior.actions.join('|');
    if (seenSignatures.has(signature)) {
      issues.push({
        optionId: validOption.id,
        code: 'duplicate_behavior',
        message: `Duplicate behavior signature: ${signature}`,
      });
    }
    seenSignatures.add(signature);

    for (const category of classifyOption(validOption)) {
      coveredCategories.add(category);
    }
  }

  if ((validation.requireDiversity ?? true) && options.length >= 4) {
    for (const required of ['active', 'conservative', 'social', 'risk'] as const) {
      if (!coveredCategories.has(required)) {
        issues.push({
          optionId: 'options',
          code: 'diversity_missing',
          message: `Missing required option category: ${required}`,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues, options: parsedOptions };
}
