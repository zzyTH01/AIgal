import { z } from 'zod';
import { optionConditionsSchema } from './option.js';
import { gameTimestampSchema, idSchema, percentSchema, timeStringSchema } from './primitives.js';

/**
 * Pending Intent（Master Design §11 / Event Life Plan P1）：
 * 角色"现在还想做什么"。与 Memory（过去）严格分离——Intent 是未来行为的种子。
 * 生命周期：waiting（等待）→ triggered（择机触发）→ completed（执行完成）；
 * 超时 → expired；条件消失 → cancelled。
 */
export const pendingIntentStatusSchema = z.enum([
  'waiting',
  'triggered',
  'completed',
  'cancelled',
  'expired',
]);

/** 触发条件复用 Option 的 ConditionSet 语义（evaluateConditions 直接消费）。 */
export const pendingIntentSchema = z
  .object({
    id: idSchema,
    characterId: idSchema,
    /** 角色想做什么（如"想继续向玩家讲述真实历史"）。 */
    summary: z.string().min(1).max(200),
    /** 因什么事件/轮次产生（因果可追溯）。 */
    sourceEventId: idSchema.optional(),
    sourceTurnId: idSchema.optional(),
    /** P0.5 motive 思维链→P1 数据源：产生该意图时的角色内心动机快照。 */
    sourceMotive: z.string().max(200).optional(),
    priority: percentSchema,
    conditions: optionConditionsSchema,
    preferredLocations: z.array(idSchema),
    /** 适合时间段（HH:mm，闭区间）。 */
    preferredTimeRange: z
      .object({ from: timeStringSchema, to: timeStringSchema })
      .strict()
      .optional(),
    /** 最晚触发日：超过则过期（防意图无限滞留）。 */
    latestTriggerDay: z.number().int().min(1),
    createdAt: gameTimestampSchema,
    status: pendingIntentStatusSchema,
    triggeredEventId: idSchema.optional(),
    resolvedAt: gameTimestampSchema.optional(),
  })
  .strict();

export const pendingIntentStateSchema = z
  .object({
    intents: z.record(idSchema, pendingIntentSchema),
  })
  .strict();

export type PendingIntentStatus = z.infer<typeof pendingIntentStatusSchema>;
export type PendingIntent = z.infer<typeof pendingIntentSchema>;
export type PendingIntentState = z.infer<typeof pendingIntentStateSchema>;
