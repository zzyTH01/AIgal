import { z } from 'zod';
import { idSchema, percentSchema } from './primitives.js';

export const characterStatusSchema = z.enum([
  'active',
  'unavailable',
  'absent',
  'asleep',
  'disabled',
]);

export const characterIdentitySchema = z
  .object({
    name: z.string().min(1),
    age: z.number().int().min(18),
    gender: z.string(),
    genderIdentity: z.string(),
    sexualOrientation: z.string(),
    role: z.string(),
    description: z.string(),
  })
  .strict();

export const personalityStateSchema = z
  .object({
    traits: z.record(z.string(), percentSchema),
    independence: percentSchema,
    confidence: percentSchema,
    sociability: percentSchema,
    sensitivity: percentSchema,
    assertiveness: percentSchema,
    empathy: percentSchema,
    openness: percentSchema,
  })
  .strict();

export const psychologyStateSchema = z
  .object({
    dependence: percentSchema,
    security: percentSchema,
    loneliness: percentSchema,
    stress: percentSchema,
    jealousy: percentSchema,
    selfWorth: percentSchema,
    emotionalStability: percentSchema,
    romanticTension: percentSchema,
  })
  .strict();

export const emotionStateSchema = z
  .object({
    primary: z.string().min(1),
    secondary: z.string().optional(),
    intensity: percentSchema,
    valence: z.number().min(-100).max(100),
    energy: percentSchema,
  })
  .strict();

export const cognitionStateSchema = z
  .object({
    memoryCapacity: percentSchema,
    encoding: percentSchema,
    retention: percentSchema,
    retrieval: percentSchema,
    forgetfulness: percentSchema,
    grudge: percentSchema,
    obsession: percentSchema,
    attention: percentSchema,
    emotionalSalience: percentSchema,
    cognitiveLoad: percentSchema,
  })
  .strict();

export const physicalStateSchema = z
  .object({
    energy: percentSchema,
    fatigue: percentSchema,
    health: percentSchema,
    hunger: percentSchema,
    sleepiness: percentSchema,
  })
  .strict();

export const characterActivityStateSchema = z
  .object({
    locationId: idSchema,
    activity: z.string(),
    availability: percentSchema,
    scheduleState: z.string().optional(),
    currentGoal: z.string().optional(),
  })
  .strict();

export const characterStateSchema = z
  .object({
    characterId: idSchema,
    identity: characterIdentitySchema,
    personality: personalityStateSchema,
    psychology: psychologyStateSchema,
    emotion: emotionStateSchema,
    cognition: cognitionStateSchema,
    physical: physicalStateSchema,
    activity: characterActivityStateSchema,
    status: characterStatusSchema,
  })
  .strict();

export type CharacterStatus = z.infer<typeof characterStatusSchema>;
export type CharacterIdentity = z.infer<typeof characterIdentitySchema>;
export type PersonalityState = z.infer<typeof personalityStateSchema>;
export type PsychologyState = z.infer<typeof psychologyStateSchema>;
export type EmotionState = z.infer<typeof emotionStateSchema>;
export type CognitionState = z.infer<typeof cognitionStateSchema>;
export type PhysicalState = z.infer<typeof physicalStateSchema>;
export type CharacterActivityState = z.infer<typeof characterActivityStateSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
