import { z } from 'zod';
import { gameTimestampSchema, idSchema, percentSchema } from './primitives.js';

/** 跨 Run 情报。 */
export const knowledgeRecordSchema = z
  .object({
    id: idSchema,
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()),
    sourceRunId: idSchema.optional(),
    acquiredAt: gameTimestampSchema.optional(),
  })
  .strict();

/** 跨 Run 保留的 Meta Memory。 */
export const metaMemoryRecordSchema = z
  .object({
    id: idSchema,
    content: z.string(),
    createdAt: gameTimestampSchema,
    importance: percentSchema,
    tags: z.array(z.string()),
    sourceRunId: idSchema.optional(),
  })
  .strict();

export const metaStateSchema = z
  .object({
    runCount: z.number().int().nonnegative(),
    completedRuns: z.number().int().nonnegative(),
    knowledge: z.record(idSchema, knowledgeRecordSchema),
    memories: z.array(metaMemoryRecordSchema),
    unlocks: z.array(z.string()),
    achievements: z.array(z.string()),
    endingsDiscovered: z.array(z.string()),
    permanentModifiers: z.record(z.string(), z.number()),
  })
  .strict();

export type KnowledgeRecord = z.infer<typeof knowledgeRecordSchema>;
export type MetaMemoryRecord = z.infer<typeof metaMemoryRecordSchema>;
export type MetaState = z.infer<typeof metaStateSchema>;
