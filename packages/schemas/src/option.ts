import { z } from 'zod';
import { idSchema, numericConditionSchema, ratioSchema } from './primitives.js';

const optionConditionValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  numericConditionSchema,
]);

/**
 * LLM 侧宽松条件：真实模型常输出 array/null/带额外键的对象。
 * plannedOptionSchema 使用本 schema；最终入库仍走严格 optionSchema。
 */
const llmNumericConditionSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .passthrough();

export const llmOptionConditionValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  llmNumericConditionSchema,
  z.array(z.string()),
  z.null(),
]);
export const llmOptionConditionsSchema = z.record(z.string(), llmOptionConditionValueSchema);

export const optionPresentationSchema = z
  .object({
    text: z.string().min(1),
    tone: z.string().min(1),
  })
  .strict();

export const optionBehaviorSchema = z
  .object({
    actions: z.array(z.string()).min(1),
    intent: z.array(z.string()).min(1),
    risk: ratioSchema,
  })
  .strict();

export const optionGameplaySchema = z
  .object({
    progress: z.number().int().nonnegative(),
  })
  .strict();

/** effects 只是 base 倾向；最终值由 StateResolver 计算。 */
export const optionEffectsSchema = z.record(
  z.string(),
  z
    .object({
      base: z.number(),
    })
    .strict(),
);

export const optionConditionsSchema = z.record(z.string(), optionConditionValueSchema);

export const optionGenerationSchema = z
  .object({
    must_fit_character: z.boolean(),
    must_fit_context: z.boolean(),
    variation: z.enum(['low', 'medium', 'high']),
  })
  .strict();

export const optionSchema = z
  .object({
    id: idSchema,
    presentation: optionPresentationSchema,
    behavior: optionBehaviorSchema,
    gameplay: optionGameplaySchema,
    effects: optionEffectsSchema,
    conditions: optionConditionsSchema,
    generation: optionGenerationSchema,
  })
  .strict();

export type OptionConditionValue = z.infer<typeof optionConditionValueSchema>;
export type OptionPresentation = z.infer<typeof optionPresentationSchema>;
export type OptionBehavior = z.infer<typeof optionBehaviorSchema>;
export type OptionGameplay = z.infer<typeof optionGameplaySchema>;
export type OptionEffects = z.infer<typeof optionEffectsSchema>;
export type OptionConditions = z.infer<typeof optionConditionsSchema>;
export type OptionGeneration = z.infer<typeof optionGenerationSchema>;
export type Option = z.infer<typeof optionSchema>;
