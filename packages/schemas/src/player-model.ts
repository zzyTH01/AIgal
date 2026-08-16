import { z } from 'zod';
import { percentSchema } from './primitives.js';

/**
 * PlayerModel 是“角色对玩家的主观认知”，不是玩家的客观属性。
 * 不同角色对同一玩家可以持有不同的 PlayerModel。
 */
export const playerModelSchema = z
  .object({
    perceivedTraits: z.record(z.string(), percentSchema),
    perceivedIntentions: z.record(z.string(), percentSchema),
    behavioralPatterns: z.record(z.string(), z.number().nonnegative()),
    recentBehaviorPattern: z.array(z.string()),
    reliability: percentSchema,
    honesty: percentSchema,
    caring: percentSchema,
    confidence: percentSchema,
    romanticInterest: percentSchema,
    perceivedControl: percentSchema,
  })
  .strict();

export type PlayerModel = z.infer<typeof playerModelSchema>;
