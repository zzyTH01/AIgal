import { z } from 'zod';
import { idSchema, percentSchema } from './primitives.js';

export const relationshipTypeSchema = z.enum([
  'unknown',
  'stranger',
  'acquaintance',
  'friend',
  'close_friend',
  'romantic_interest',
  'partner',
  'family',
  'rival',
  'enemy',
  'estranged',
  'custom',
]);

export const relationshipStatusSchema = z.enum(['active', 'strained', 'broken', 'ended']);

export const relationshipStateSchema = z
  .object({
    relationshipId: idSchema,
    sourceId: idSchema,
    targetId: idSchema,
    type: relationshipTypeSchema,
    affection: percentSchema,
    trust: percentSchema,
    intimacy: percentSchema,
    familiarity: percentSchema,
    attraction: percentSchema,
    conflict: percentSchema,
    respect: percentSchema,
    dependency: percentSchema,
    currentLabel: z.string().optional(),
    tags: z.array(z.string()),
    status: relationshipStatusSchema,
    customMetrics: z.record(z.string(), z.number()),
  })
  .strict();

export type RelationshipType = z.infer<typeof relationshipTypeSchema>;
export type RelationshipStatus = z.infer<typeof relationshipStatusSchema>;
export type RelationshipState = z.infer<typeof relationshipStateSchema>;
