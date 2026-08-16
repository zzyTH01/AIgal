import { z } from 'zod';
import {
  characterIdentitySchema,
  cognitionStateSchema,
  personalityStateSchema,
  psychologyStateSchema,
} from './character.js';
import { idSchema, percentSchema, schemaVersionSchema } from './primitives.js';
import { relationshipTypeSchema } from './relationship.js';

export const characterPreferencesSchema = z
  .object({
    likes: z.array(z.string()),
    dislikes: z.array(z.string()),
    interests: z.array(z.string()),
  })
  .strict();

export const characterSpeechSchema = z
  .object({
    style: z.string(),
    tone: z.string(),
    vocabulary: z.array(z.string()),
    examples: z.array(z.string()),
  })
  .strict();

export const characterSecretSchema = z
  .object({
    id: idSchema,
    content: z.string(),
    revealCondition: z.string(),
  })
  .strict();

export const characterGoalSchema = z
  .object({
    id: idSchema,
    description: z.string(),
    priority: percentSchema,
    progress: percentSchema.optional(),
  })
  .strict();

export const relationshipDefaultsSchema = z
  .object({
    initialType: relationshipTypeSchema,
    metrics: z.record(z.string(), percentSchema),
    tags: z.array(z.string()),
  })
  .strict();

export const gameParameterSchema = z.record(z.string(), z.number());

/**
 * CharacterDefinition 是作者创作的可迁移角色定义。
 * Character Compiler 将其编译为 Game Character + SillyTavern Card + World Book + Prompt。
 */
export const characterDefinitionSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    characterId: idSchema,
    identity: characterIdentitySchema,
    personality: personalityStateSchema,
    preferences: characterPreferencesSchema,
    speech: characterSpeechSchema,
    psychologyDefaults: psychologyStateSchema,
    cognition: cognitionStateSchema,
    relationshipDefaults: relationshipDefaultsSchema,
    secrets: z.array(characterSecretSchema),
    goals: z.array(characterGoalSchema),
    boundaries: z.array(z.string()),
    gameParameters: gameParameterSchema,
  })
  .strict();

export type CharacterPreferences = z.infer<typeof characterPreferencesSchema>;
export type CharacterSpeech = z.infer<typeof characterSpeechSchema>;
export type CharacterSecret = z.infer<typeof characterSecretSchema>;
export type CharacterGoal = z.infer<typeof characterGoalSchema>;
export type RelationshipDefaults = z.infer<typeof relationshipDefaultsSchema>;
export type GameParameterMap = z.infer<typeof gameParameterSchema>;
export type CharacterDefinition = z.infer<typeof characterDefinitionSchema>;
