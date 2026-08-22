import { z } from 'zod';
import { memoryCandidateSchema } from './memory.js';
import { idSchema, schemaVersionSchema, timeStringSchema } from './primitives.js';

/**
 * Transition System（Master Design §11.2 / Event Life Plan P0）：
 * 事件与事件、选项与选项之间的过渡。状态层（time/location/environment/余波）
 * 与表现层（旁白+对话文段）合一，由 Runtime 编排生成。
 */

export const transitionSpeakerSchema = z.string();
export type TransitionSpeaker = z.infer<typeof transitionSpeakerSchema>;

/** 过渡对话行：speakerId 为 characterId，或 'narrator'（旁白）/ 'player'。 */
export const transitionDialogueSchema = z
  .object({
    speakerId: transitionSpeakerSchema,
    text: z.string().min(1),
  })
  .strict();
export type TransitionDialogue = z.infer<typeof transitionDialogueSchema>;

/** 过渡文段（表现层）：Narrative Engine 生成，无 LLM 时为模板 fallback。 */
export const transitionNarrativeSchema = z
  .object({
    narration: z.string().min(1),
    dialogues: z.array(transitionDialogueSchema),
    source: z.enum(['llm', 'fallback']),
  })
  .strict();
export type TransitionNarrative = z.infer<typeof transitionNarrativeSchema>;

/** 过渡记录（状态层 + 表现层），随 TurnResult 持久化。 */
export const transitionRecordSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    /** 本过渡所属 Turn：过渡是该 Turn 的开场过场。 */
    turnId: idSchema,
    time: z
      .object({
        previous: timeStringSchema,
        current: timeStringSchema,
        crossedDayBoundary: z.boolean(),
      })
      .strict(),
    location: z
      .object({
        fromLocationId: idSchema.nullable(),
        toLocationId: idSchema,
      })
      .strict(),
    /** 环境快照变化（weather/light/crowd 等），来自 WorldTick 演化结果。 */
    environment: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    /** 情绪余波：回味内容引用的历史记忆（Memory 联动②的依据）。 */
    emotionalAftermath: z
      .object({
        referencedMemoryIds: z.array(idSchema),
        summary: z.string(),
      })
      .optional(),
    /** P1 Pending Intent 预留；P0 恒为空数组。 */
    pendingIntentIds: z.array(idSchema).default([]),
    narrative: transitionNarrativeSchema,
  })
  .strict();
export type TransitionRecord = z.infer<typeof transitionRecordSchema>;

/** LLM 结构化通道：合并调用内嵌于 combined 响应，或独立 generateTransition 响应。 */
export const transitionLlmSchema = z
  .object({
    narration: z.string().min(1),
    dialogues: z.array(transitionDialogueSchema),
    /** 文段实际引用的记忆 id；引擎校验必须 ⊆ 输入检索集。 */
    referencedMemoryIds: z.array(z.string()).default([]),
    /** Memory 联动③："回想"行为本身产出新记忆候选。 */
    memoryCandidate: memoryCandidateSchema.optional(),
  })
  .strict();
export type TransitionLlmPayload = z.infer<typeof transitionLlmSchema>;
