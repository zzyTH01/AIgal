import { z } from 'zod';

/**
 * RNG 必须可 save/restore。Phase 4 将落地具体算法（如 xorshift128），
 * 本 Schema 只约定 seed + algorithm + 内部 state 数组。
 */
export const rngStateSchema = z
  .object({
    seed: z.number().int().nonnegative(),
    state: z.array(z.number().int().nonnegative()),
    algorithm: z.string(),
  })
  .strict();

export type RNGState = z.infer<typeof rngStateSchema>;
