import { z } from 'zod';
import { characterDefinitionSchema } from './character-definition.js';
import { eventDefinitionSchema } from './event.js';
import { optionBehaviorSchema, optionEffectsSchema, optionGenerationSchema } from './option.js';
import {
  flagsSchema,
  idSchema,
  numericConditionSchema,
  percentSchema,
  schemaVersionSchema,
  seasonSchema,
  timeStringSchema,
  weekdaySchema,
} from './primitives.js';
import { relationshipTypeSchema } from './relationship.js';

export const projectPolicySchema = z
  .object({
    ageRating: z.string(),
    relationshipTypes: z.array(relationshipTypeSchema),
    contentTags: z.array(z.string()),
    narrativeTone: z.string(),
    matureThemes: z.array(z.string()),
    generationConstraints: z.record(z.string(), z.string()),
  })
  .strict();

export const projectLocationDefinitionSchema = z
  .object({
    locationId: idSchema,
    name: z.string().min(1),
    type: z.string(),
    tags: z.array(z.string()),
    accessibility: percentSchema,
    description: z.string(),
  })
  .strict();

export const worldDefinitionSchema = z
  .object({
    worldId: idSchema,
    name: z.string(),
    description: z.string(),
    dailyProgressLimit: z.number().int().positive(),
    startDay: z.number().int().min(1),
    startTime: timeStringSchema,
    startWeekday: weekdaySchema,
    startSeason: seasonSchema,
    locations: z.array(projectLocationDefinitionSchema),
    initialWorldFlags: flagsSchema,
  })
  .strict();

export const optionTemplateSchema = z
  .object({
    templateId: idSchema,
    behavior: optionBehaviorSchema,
    effects: optionEffectsSchema,
    conditions: z.record(
      z.string(),
      z.union([z.boolean(), z.number(), z.string(), numericConditionSchema]),
    ),
    generation: optionGenerationSchema,
    presentationVariants: z.array(z.string()).min(1),
  })
  .strict();

export const endingKindSchema = z.enum(['good', 'normal', 'bad', 'custom']);
export const endingDefinitionSchema = z
  .object({
    endingId: idSchema,
    kind: endingKindSchema,
    title: z.string(),
    description: z.string(),
    conditions: z.record(
      z.string(),
      z.union([z.boolean(), z.number(), z.string(), numericConditionSchema]),
    ),
    priority: z.number().int().nonnegative(),
  })
  .strict();

/**
 * 一个 Project = 一款完整的 AI GALGAME。
 * JSON 内容对应 Project Package 中的 project.json；其余目录为 resources/saves/meta。
 */
export const gameProjectSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    projectId: idSchema,
    name: z.string(),
    version: z.string(),
    description: z.string(),
    policy: projectPolicySchema,
    characters: z.array(characterDefinitionSchema),
    world: worldDefinitionSchema,
    parameters: z.record(z.string(), z.number()),
    optionTemplates: z.array(optionTemplateSchema),
    events: z.array(eventDefinitionSchema),
    endings: z.array(endingDefinitionSchema),
    prompts: z.record(z.string(), z.string()),
    assets: z.record(z.string(), z.string()),
  })
  .strict();

export type ProjectPolicy = z.infer<typeof projectPolicySchema>;
export type ProjectLocationDefinition = z.infer<typeof projectLocationDefinitionSchema>;
export type WorldDefinition = z.infer<typeof worldDefinitionSchema>;
export type OptionTemplate = z.infer<typeof optionTemplateSchema>;
export type EndingKind = z.infer<typeof endingKindSchema>;
export type EndingDefinition = z.infer<typeof endingDefinitionSchema>;
export type GameProject = z.infer<typeof gameProjectSchema>;
