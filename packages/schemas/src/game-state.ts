import { z } from 'zod';
import { characterStateSchema } from './character.js';
import { metaStateSchema } from './meta.js';
import { memoryStateSchema } from './memory.js';
import { playerModelSchema } from './player-model.js';
import { flagsSchema, idSchema, schemaVersionSchema, timeStringSchema } from './primitives.js';
import { relationshipStateSchema } from './relationship.js';
import { rngStateSchema } from './rng.js';
import { worldStateSchema } from './world.js';

export const runStatusSchema = z.enum([
  'not_started',
  'active',
  'paused',
  'ending',
  'completed',
  'bad_end',
]);

export const runStateSchema = z
  .object({
    runId: idSchema,
    startedAt: z.string(),
    day: z.number().int().nonnegative(),
    turn: z.number().int().nonnegative(),
    time: timeStringSchema,
    dailyProgress: z.number().int().nonnegative(),
    dailyProgressLimit: z.number().int().positive(),
    currentEventId: idSchema.optional(),
    currentLocationId: idSchema,
    status: runStatusSchema,
  })
  .strict();

export const gameStateSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    run: runStateSchema,
    world: worldStateSchema,
    characters: z.record(idSchema, characterStateSchema),
    relationships: z.record(idSchema, relationshipStateSchema),
    flags: flagsSchema,
    playerModel: playerModelSchema,
    memories: memoryStateSchema,
    meta: metaStateSchema,
    rng: rngStateSchema,
  })
  .strict();

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunState = z.infer<typeof runStateSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
