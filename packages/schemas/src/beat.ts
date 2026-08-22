import { z } from 'zod';
import { optionSchema } from './option.js';
import { idSchema } from './primitives.js';
import { transitionDialogueSchema } from './transition.js';

/**
 * Beat System（P0.5，BEAT_SYSTEM_DESIGN.md）：
 * 事件内连续叙事流的最小单元。NarrativeBeat 与 ChoiceBeat 契约互斥——
 * 文段在结构上不可能预支选项，选项仅由选择拍通道产生。
 */

export const beatKindSchema = z.enum(['narrative', 'choice']);
export type BeatKind = z.infer<typeof beatKindSchema>;

/** 分支价值：LLM 建议，引擎裁决（FlowController 结合预算/间隔/张力信号定夺）。 */
export const branchPotentialSchema = z.enum(['high', 'mid', 'low']);
export type BranchPotential = z.infer<typeof branchPotentialSchema>;

export const nextStepSuggestionSchema = z.enum(['choice', 'beat', 'end']);
export type NextStepSuggestion = z.infer<typeof nextStepSuggestionSchema>;

export const beatSourceSchema = z.enum(['llm', 'fallback']);
export type BeatSource = z.infer<typeof beatSourceSchema>;

/** 文段拍：旁白+对话 + 轻量情绪漂移；无 options 字段。 */
export const narrativeBeatSchema = z
  .object({
    beatId: idSchema,
    kind: z.literal('narrative'),
    narration: z.string().min(1),
    dialogues: z.array(transitionDialogueSchema),
    source: beatSourceSchema,
    branchPotential: branchPotentialSchema.default('mid'),
    /** 仅建议：FlowController 结合硬约束裁决。 */
    nextSuggestion: nextStepSuggestionSchema.optional(),
    /** 轻量情绪漂移 { metric: delta }，引擎 clamp ±3。 */
    emotionDrift: z.record(z.string(), z.number()).optional(),
  })
  .strict();
export type NarrativeBeat = z.infer<typeof narrativeBeatSchema>;

/** 选择拍：极简引子 + 2–4 选项；禁止长旁白。 */
export const choiceBeatSchema = z
  .object({
    beatId: idSchema,
    kind: z.literal('choice'),
    intro: z.string().max(160).optional(),
    options: z.array(optionSchema).min(2).max(4),
    source: beatSourceSchema,
  })
  .strict();
export type ChoiceBeat = z.infer<typeof choiceBeatSchema>;

export const beatSchema = z.discriminatedUnion('kind', [narrativeBeatSchema, choiceBeatSchema]);
export type Beat = z.infer<typeof beatSchema>;

/** 事件重要性 → 拍数预算与数值放大系数（与 P3 的 level 字段统一）。 */
export const eventImportanceSchema = z.enum(['main', 'side', 'micro']);
export type EventImportance = z.infer<typeof eventImportanceSchema>;

/** 事件流状态（runtime 内态，随存档持久化以便恢复到选择点）。 */
export const eventFlowStatusSchema = z.enum(['flowing', 'awaiting-choice', 'ended']);
export type EventFlowStatus = z.infer<typeof eventFlowStatusSchema>;

export const eventFlowSchema = z
  .object({
    eventId: idSchema.nullable(),
    importance: eventImportanceSchema.default('side'),
    beatsUsed: z.number().int().nonnegative(),
    maxBeats: z.number().int().positive(),
    choicesUsed: z.number().int().nonnegative(),
    maxChoices: z.number().int().nonnegative(),
    beatsSinceLastChoice: z.number().int().nonnegative(),
    status: eventFlowStatusSchema,
    /** 事件内滚动上下文：每拍压缩 1–2 句，全量进入下一选择点生成。 */
    beatSummaries: z.array(z.string()),
    pendingTension: z.string().optional(),
  })
  .strict();
export type EventFlow = z.infer<typeof eventFlowSchema>;
