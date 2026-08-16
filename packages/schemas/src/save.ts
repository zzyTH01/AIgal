import { z } from 'zod';
import { gameStateSchema } from './game-state.js';
import { gameTimestampSchema, idSchema, schemaVersionSchema } from './primitives.js';
import { turnResultSchema } from './turn-result.js';

export const saveMetadataSchema = z
  .object({
    saveId: idSchema,
    runId: idSchema,
    label: z.string().optional(),
    createdAt: gameTimestampSchema,
    day: z.number().int().nonnegative(),
    turn: z.number().int().nonnegative(),
  })
  .strict();

/**
 * SaveSnapshot = SaveMetadata + 完整 GameState 快照 + Turn 历史。
 * V1 落盘为 JSON Directory（saves/run_<id>/...），后期迁移 SQLite。
 */
export const saveSnapshotSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    metadata: saveMetadataSchema,
    gameState: gameStateSchema,
    turnHistory: z.array(turnResultSchema),
  })
  .strict();

export type SaveMetadata = z.infer<typeof saveMetadataSchema>;
export type SaveSnapshot = z.infer<typeof saveSnapshotSchema>;
