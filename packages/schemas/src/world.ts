import { z } from 'zod';
import {
  eventRaritySchema,
  eventTypeSchema,
  flagsSchema,
  idSchema,
  percentSchema,
  seasonSchema,
  timeStringSchema,
  weekdaySchema,
} from './primitives.js';

export const weatherStateSchema = z
  .object({
    type: z.string(),
    intensity: percentSchema,
    temperature: z.number(),
    visibility: percentSchema,
  })
  .strict();

export const locationStateSchema = z
  .object({
    type: z.string(),
    tags: z.array(z.string()),
    accessibility: z.string(),
    active: z.boolean(),
    currentCharacters: z.array(idSchema),
  })
  .strict();

/**
 * 世界中已存在的事件状态（公共事件/进行中事件）。
 * 权重与冷却用于 Phase 4 的 EventScore 计算；具体选择规则由 World Engine 实现。
 */
export const worldEventStateSchema = z
  .object({
    eventId: idSchema,
    type: eventTypeSchema,
    rarity: eventRaritySchema,
    title: z.string(),
    description: z.string(),
    weight: z.number().nonnegative(),
    lastTriggeredDay: z.number().int().nonnegative().optional(),
  })
  .strict();

export const worldStateSchema = z
  .object({
    day: z.number().int().nonnegative(),
    time: timeStringSchema,
    weekday: weekdaySchema,
    season: seasonSchema,
    weather: weatherStateSchema,
    currentLocationId: idSchema,
    locations: z.record(idSchema, locationStateSchema),
    publicEvents: z.array(worldEventStateSchema),
    activeEvents: z.array(worldEventStateSchema),
    worldFlags: flagsSchema.optional(),
  })
  .strict();

export type WeatherState = z.infer<typeof weatherStateSchema>;
export type LocationState = z.infer<typeof locationStateSchema>;
export type WorldEventState = z.infer<typeof worldEventStateSchema>;
export type WorldState = z.infer<typeof worldStateSchema>;
