import { z } from 'zod';
import {
  eventRaritySchema,
  eventTypeSchema,
  gameTimestampSchema,
  idSchema,
  numericConditionSchema,
} from './primitives.js';
import { relationshipTypeSchema } from './relationship.js';
import { eventImportanceSchema } from './beat.js';
import { finalStateDeltaSchema } from './state-delta.js';

const eventConditionValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  numericConditionSchema,
]);

export const eventCooldownSchema = z
  .object({
    days: z.number().int().nonnegative(),
    turns: z.number().int().nonnegative(),
  })
  .strict();

/**
 * EventDefinition 是作者定义的世界“物理定律”的一部分：
 * 事件向 AI 提供类型、条件、行为约束，但不包含固定剧情文本。
 */
export const eventDefinitionSchema = z
  .object({
    eventId: idSchema,
    type: eventTypeSchema,
    rarity: eventRaritySchema,
    title: z.string(),
    description: z.string(),
    baseWeight: z.number().nonnegative(),
    conditions: z.record(z.string(), eventConditionValueSchema),
    cooldown: eventCooldownSchema,
    allowedLocationIds: z.array(idSchema).optional(),
    tags: z.array(z.string()).optional(),
    requiresCharacterIds: z.array(idSchema).optional(),
    requiresRelationshipType: relationshipTypeSchema.optional(),
    behaviorConstraints: z.array(z.string()).optional(),
    /** P0.5 Beat System：重要性 → 拍数预算与数值放大（main ×1.25 / side ×1.0 / micro ×0.75）。 */
    importance: eventImportanceSchema.default('side'),
  })
  .strict();

/**
 * EventCandidate 是事件选择阶段的计分中间结果（Master Design §2.6）：
 * EventScore = BaseWeight × ContextModifier × CharacterModifier × RelationshipModifier × RandomFactor。
 */
export const eventCandidateSchema = z
  .object({
    eventId: idSchema,
    eligible: z.boolean(),
    baseWeight: z.number().nonnegative(),
    contextModifier: z.number(),
    characterModifier: z.number(),
    relationshipModifier: z.number(),
    randomFactor: z.number().nonnegative(),
    score: z.number().nonnegative(),
  })
  .strict();

export const eventInstanceStatusSchema = z.enum(['pending', 'active', 'resolved', 'expired']);

/** EventInstance 是一次 Run 中实际发生的具体事件容器。 */
export const eventInstanceSchema = z
  .object({
    instanceId: idSchema,
    eventId: idSchema,
    runId: idSchema,
    day: z.number().int().nonnegative(),
    turn: z.number().int().nonnegative(),
    locationId: idSchema,
    title: z.string(),
    description: z.string(),
    status: eventInstanceStatusSchema,
    createdAt: gameTimestampSchema,
    resolvedAt: gameTimestampSchema.optional(),
  })
  .strict();

export const eventResultOutcomeSchema = z.enum(['completed', 'skipped', 'failed']);

export const eventResultSchema = z
  .object({
    instanceId: idSchema,
    eventId: idSchema,
    outcome: eventResultOutcomeSchema,
    finalDelta: finalStateDeltaSchema.optional(),
    endingTriggered: z.boolean().optional(),
    resolvedAt: gameTimestampSchema,
  })
  .strict();

export type EventConditionValue = z.infer<typeof eventConditionValueSchema>;
export type EventCooldown = z.infer<typeof eventCooldownSchema>;
export type EventDefinition = z.infer<typeof eventDefinitionSchema>;
export type EventCandidate = z.infer<typeof eventCandidateSchema>;
export type EventInstanceStatus = z.infer<typeof eventInstanceStatusSchema>;
export type EventInstance = z.infer<typeof eventInstanceSchema>;
export type EventResultOutcome = z.infer<typeof eventResultOutcomeSchema>;
export type EventResult = z.infer<typeof eventResultSchema>;
