import { z } from 'zod';
import { characterStatusSchema } from './character.js';
import { memoryCandidateSchema } from './memory.js';
import { knowledgeRecordSchema, metaMemoryRecordSchema } from './meta.js';
import { flagValueSchema, idSchema, timeStringSchema } from './primitives.js';
import { runStatusSchema } from './game-state.js';
import { weatherStateSchema } from './world.js';

/** 一次数值结算的审计三元组：before / after / delta。 */
export const metricChangeSchema = z
  .object({
    before: z.number(),
    after: z.number(),
    delta: z.number(),
  })
  .strict();

/** Flags 补丁：set 写入、unset 删除。 */
export const flagsPatchSchema = z
  .object({
    set: z.record(z.string(), flagValueSchema).optional(),
    unset: z.array(z.string()).optional(),
  })
  .strict();

/** Meta 补丁：records 按 id upsert，数组追加去重，数值 map 合并。 */
export const metaPatchSchema = z
  .object({
    knowledge: z.record(idSchema, knowledgeRecordSchema).optional(),
    memories: z.array(metaMemoryRecordSchema).optional(),
    unlocks: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    endingsDiscovered: z.array(z.string()).optional(),
    permanentModifiers: z.record(z.string(), z.number()).optional(),
  })
  .strict();

/** Base Delta：AI 或 Option 提出的原始倾向，未经任何 Modifier。 */
export const runBaseDeltaSchema = z
  .object({
    dailyProgressDelta: z.number().int().optional(),
    dayDelta: z.number().int().optional(),
    turnDelta: z.number().int().optional(),
    time: timeStringSchema.optional(),
    currentEventId: idSchema.optional(),
    currentLocationId: idSchema.optional(),
    status: runStatusSchema.optional(),
  })
  .strict();

export const characterBaseDeltaSchema = z
  .object({
    psychology: z.record(z.string(), z.number()).optional(),
    emotion: z.record(z.string(), z.number()).optional(),
    physical: z.record(z.string(), z.number()).optional(),
    status: characterStatusSchema.optional(),
  })
  .strict();

export const relationshipBaseDeltaSchema = z.record(z.string(), z.number());

export const worldBaseDeltaSchema = z
  .object({
    weather: weatherStateSchema.partial().optional(),
    flagsPatch: flagsPatchSchema.optional(),
    currentLocationId: idSchema.optional(),
    time: timeStringSchema.optional(),
  })
  .strict();

export const baseStateDeltaSchema = z
  .object({
    phase: z.literal('base'),
    run: runBaseDeltaSchema.optional(),
    characters: z.record(idSchema, characterBaseDeltaSchema).optional(),
    relationships: z.record(idSchema, relationshipBaseDeltaSchema).optional(),
    world: worldBaseDeltaSchema.optional(),
    flags: flagsPatchSchema.optional(),
    memoryCandidates: z.array(memoryCandidateSchema).optional(),
    meta: metaPatchSchema.optional(),
  })
  .strict();

/** Modifier Delta：StateResolver 在 Base 之上计算的各来源乘数/修正。 */
export const modifierStateDeltaSchema = z
  .object({
    phase: z.literal('modifier'),
    modifiers: z.record(z.string(), z.number()),
    riskOutcome: z.enum(['success', 'failure']).optional(),
  })
  .strict();

/** Final Delta：StateResolver 确认后的最终数值变化，可安全 apply。 */
export const runFinalDeltaSchema = z
  .object({
    day: z.number().int().nonnegative().optional(),
    turn: z.number().int().nonnegative().optional(),
    time: timeStringSchema.optional(),
    dailyProgress: z.number().int().nonnegative().optional(),
    currentEventId: idSchema.optional(),
    currentLocationId: idSchema.optional(),
    status: runStatusSchema.optional(),
  })
  .strict();

export const characterFinalDeltaSchema = z
  .object({
    psychology: z.record(z.string(), metricChangeSchema).optional(),
    emotion: z.record(z.string(), metricChangeSchema).optional(),
    physical: z.record(z.string(), metricChangeSchema).optional(),
    status: characterStatusSchema.optional(),
  })
  .strict();

export const relationshipFinalDeltaSchema = z.record(z.string(), metricChangeSchema);

export const worldFinalDeltaSchema = z
  .object({
    weather: weatherStateSchema.partial().optional(),
    flagsPatch: flagsPatchSchema.optional(),
    currentLocationId: idSchema.optional(),
    time: timeStringSchema.optional(),
  })
  .strict();

export const finalStateDeltaSchema = z
  .object({
    phase: z.literal('final'),
    run: runFinalDeltaSchema.optional(),
    characters: z.record(idSchema, characterFinalDeltaSchema).optional(),
    relationships: z.record(idSchema, relationshipFinalDeltaSchema).optional(),
    world: worldFinalDeltaSchema.optional(),
    flags: flagsPatchSchema.optional(),
    memoryCandidates: z.array(memoryCandidateSchema).optional(),
    meta: metaPatchSchema.optional(),
  })
  .strict();

/**
 * StateDelta 是 Option → StateResolver → GameState 的唯一变更契约。
 * 任何引擎状态写入必须使用 final phase；base/modifier 仅用于计算与审计。
 */
export const stateDeltaSchema = z.discriminatedUnion('phase', [
  baseStateDeltaSchema,
  modifierStateDeltaSchema,
  finalStateDeltaSchema,
]);

export type MetricChange = z.infer<typeof metricChangeSchema>;
export type FlagsPatch = z.infer<typeof flagsPatchSchema>;
export type MetaPatch = z.infer<typeof metaPatchSchema>;
export type RunBaseDelta = z.infer<typeof runBaseDeltaSchema>;
export type CharacterBaseDelta = z.infer<typeof characterBaseDeltaSchema>;
export type RelationshipBaseDelta = z.infer<typeof relationshipBaseDeltaSchema>;
export type WorldBaseDelta = z.infer<typeof worldBaseDeltaSchema>;
export type BaseStateDelta = z.infer<typeof baseStateDeltaSchema>;
export type ModifierStateDelta = z.infer<typeof modifierStateDeltaSchema>;
export type RunFinalDelta = z.infer<typeof runFinalDeltaSchema>;
export type CharacterFinalDelta = z.infer<typeof characterFinalDeltaSchema>;
export type RelationshipFinalDelta = z.infer<typeof relationshipFinalDeltaSchema>;
export type WorldFinalDelta = z.infer<typeof worldFinalDeltaSchema>;
export type FinalStateDelta = z.infer<typeof finalStateDeltaSchema>;
export type StateDelta = z.infer<typeof stateDeltaSchema>;
