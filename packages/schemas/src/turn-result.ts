import { z } from 'zod';
import { beatSchema } from './beat.js';
import { gameStateSchema } from './game-state.js';
import { memoryCandidateSchema, memoryRecordSchema } from './memory.js';
import { playerModelSchema } from './player-model.js';
import { idSchema, percentSchema, schemaVersionSchema } from './primitives.js';
import { finalStateDeltaSchema } from './state-delta.js';
import { transitionRecordSchema } from './transition.js';
import { worldStateSchema } from './world.js';

export const turnChoiceSchema = z
  .object({
    turnId: idSchema,
    optionId: idSchema,
  })
  .strict();

/**
 * AI 双通道输出的结构化通道（NPC Reaction）。
 * 引擎只消费该结构；所有数值仍需经 StateResolver 确认。
 */
export const npcReactionStructuredSchema = z
  .object({
    emotion: z
      .object({
        type: z.string(),
        intensity: percentSchema,
      })
      .strict()
      .optional(),
    intent: z
      .object({
        type: z.string(),
        intensity: percentSchema,
      })
      .strict()
      .optional(),
    memoryCandidates: z.array(memoryCandidateSchema).optional(),
  })
  .strict();

export const npcReactionSchema = z
  .object({
    narrative: z.string(),
    structured: npcReactionStructuredSchema,
  })
  .strict();

/**
 * TurnResult 是单个原子叙事事务的完整结果快照。
 * stateBefore / finalState 用于回滚审计与 Replay；delta 字段用于存储效率与调试。
 */
export const turnResultSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    turnId: idSchema,
    runId: idSchema,
    stateBefore: gameStateSchema,
    choice: turnChoiceSchema,
    directDelta: finalStateDeltaSchema,
    reaction: npcReactionSchema,
    secondaryDelta: finalStateDeltaSchema,
    newMemories: z.array(memoryRecordSchema),
    playerModel: playerModelSchema,
    worldUpdate: worldStateSchema,
    /** P0 Transition System：本 Turn 的开场过场（可选，旧存档/旧路径缺省）。 */
    transition: transitionRecordSchema.optional(),
    /** P0.5 Beat System：本次选择区间内产生的拍序列（旧档兼容 optional）。 */
    beats: z.array(beatSchema).optional(),
    finalState: gameStateSchema,
  })
  .strict();

export type TurnChoice = z.infer<typeof turnChoiceSchema>;
export type NPCReactionStructured = z.infer<typeof npcReactionStructuredSchema>;
export type NPCReaction = z.infer<typeof npcReactionSchema>;
export type TurnResult = z.infer<typeof turnResultSchema>;
