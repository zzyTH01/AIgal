import { z } from 'zod';
import { gameTimestampSchema, idSchema, percentSchema } from './primitives.js';

export const memoryTypeSchema = z.enum(['episodic', 'semantic', 'emotional', 'social']);

export const memoryRecordSchema = z
  .object({
    id: idSchema,
    type: memoryTypeSchema,
    content: z.string(),
    createdAt: gameTimestampSchema,
    importance: percentSchema,
    emotionalIntensity: percentSchema,
    valence: z.number().min(-100).max(100),
    strength: percentSchema,
    accuracy: percentSchema,
    tags: z.array(z.string()),
    relatedCharacters: z.array(idSchema),
    sourceTurnId: idSchema,
    retrievalCount: z.number().int().nonnegative(),
    lastRetrievedAt: gameTimestampSchema.optional(),
  })
  .strict();

export const memoryStateSchema = z
  .object({
    records: z.record(idSchema, memoryRecordSchema),
    shortTermIds: z.array(idSchema),
    longTermIds: z.array(idSchema),
    forgottenIds: z.array(idSchema),
    lastConsolidatedDay: z.number().int().nonnegative(),
  })
  .strict();

/**
 * Memory Candidate 是 AI/叙事引擎提出的待写入候选；
 * 只有 Memory Engine 确认后才能进入 MemoryState.records。
 */
export const memoryCandidateSchema = z
  .object({
    type: memoryTypeSchema,
    content: z.string(),
    importance: percentSchema,
    emotionalIntensity: percentSchema,
    valence: z.number().min(-100).max(100),
    tags: z.array(z.string()),
    relatedCharacters: z.array(idSchema),
    sourceTurnId: idSchema,
  })
  .strict();

export type MemoryType = z.infer<typeof memoryTypeSchema>;
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export type MemoryState = z.infer<typeof memoryStateSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
