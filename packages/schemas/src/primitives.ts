import { z } from 'zod';

/** 当前 Schema 基线版本。所有正式 Schema 均以该字面量作为 schemaVersion。 */
export const SCHEMA_VERSION = '0.1.0' as const;
export const schemaVersionSchema = z.literal(SCHEMA_VERSION);

/** 全项目共享 ID：非空字符串。 */
export const idSchema = z.string().min(1);
export type ID = z.infer<typeof idSchema>;
export type RunId = ID;
export type TurnId = ID;
export type EventId = ID;
export type CharacterId = ID;
export type RelationshipId = ID;
export type MemoryId = ID;
export type SaveId = ID;
export type OptionId = ID;
export type ProjectId = ID;
export type WorldId = ID;

/** 游戏内时间戳：{ day, time: "HH:mm" }。 */
export const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const gameTimestampSchema = z
  .object({
    day: z.number().int().nonnegative(),
    time: timeStringSchema,
  })
  .strict();

/** 0~100 百分比参数，所有百分比状态必须经本 Schema 校验。 */
export const percentSchema = z.number().min(0).max(100);

/** 0~1 概率/比例参数，用于 risk、modifier 等归一化标量。 */
export const ratioSchema = z.number().min(0).max(1);

/** 数值区间。 */
export const numericRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .strict()
  .refine((range) => range.min <= range.max, { message: 'min must be <= max' });

export const numericConditionSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict()
  .refine(
    (condition) =>
      condition.min === undefined || condition.max === undefined || condition.min <= condition.max,
    {
      message: 'min must be <= max',
    },
  );

/** 统一 Flag 值。 */
export const flagValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export const flagsSchema = z.record(z.string(), flagValueSchema);

export const weekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const seasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);

/** 事件类别（Master Design §2.6）。 */
export const eventTypeSchema = z.enum([
  'daily',
  'social',
  'exploration',
  'conflict',
  'romantic',
  'special',
  'world',
  'rare',
]);

/** 事件稀有度（Common → Legendary，Phase 4 正式启用）。 */
export const eventRaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary']);
export type EventRarity = z.infer<typeof eventRaritySchema>;

export const eventCategorySchema = eventTypeSchema;
export const eventRarityTypeSchema = eventRaritySchema;
