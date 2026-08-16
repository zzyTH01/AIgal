import { z } from 'zod';
import { eventInstanceSchema } from './event.js';
import { gameStateSchema } from './game-state.js';
import { memoryRecordSchema } from './memory.js';
import { idSchema, schemaVersionSchema, timeStringSchema } from './primitives.js';

export const contextBudgetSchema = z
  .object({
    capacity: z.number().int().positive(),
    systemRules: z.number().int().nonnegative(),
    currentState: z.number().int().nonnegative(),
    recentEvents: z.number().int().nonnegative(),
    memories: z.number().int().nonnegative(),
    internalState: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (budget) =>
      budget.systemRules +
        budget.currentState +
        budget.recentEvents +
        budget.memories +
        budget.internalState <=
      budget.capacity,
    { message: 'context budget allocations must not exceed capacity' },
  );

export const generationTaskSchema = z
  .object({
    task: z.string(),
    outputSchema: z.string(),
  })
  .strict();

/**
 * ModelContext 是每次 LLM 调用动态构建的派生数据，不是 GameState。
 * LLM 只能看到本结构，禁止直接读取完整记忆历史。
 */
export const modelContextSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    runId: idSchema,
    turnId: idSchema,
    day: z.number().int().nonnegative(),
    time: timeStringSchema,
    systemRules: z.string(),
    currentState: gameStateSchema,
    currentEvent: eventInstanceSchema.optional(),
    recentEvents: z.array(eventInstanceSchema),
    retrievedMemories: z.array(memoryRecordSchema),
    internalState: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    generationTask: generationTaskSchema,
    budget: contextBudgetSchema,
  })
  .strict();

export type ContextBudget = z.infer<typeof contextBudgetSchema>;
export type GenerationTask = z.infer<typeof generationTaskSchema>;
export type ModelContext = z.infer<typeof modelContextSchema>;
