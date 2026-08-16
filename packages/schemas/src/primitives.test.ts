import { describe, expect, it } from 'vitest';
import {
  eventRaritySchema,
  eventTypeSchema,
  gameTimestampSchema,
  idSchema,
  numericConditionSchema,
  numericRangeSchema,
  percentSchema,
  schemaVersionSchema,
  timeStringSchema,
} from './primitives.js';

describe('shared primitives', () => {
  it('validates ID as non-empty string', () => {
    expect(idSchema.safeParse('char_mio').success).toBe(true);
    expect(idSchema.safeParse('').success).toBe(false);
  });

  it('validates percent range 0~100', () => {
    expect(percentSchema.safeParse(0).success).toBe(true);
    expect(percentSchema.safeParse(100).success).toBe(true);
    expect(percentSchema.safeParse(-1).success).toBe(false);
    expect(percentSchema.safeParse(100.1).success).toBe(false);
  });

  it('validates HH:mm timestamps', () => {
    expect(gameTimestampSchema.safeParse({ day: 1, time: '09:00' }).success).toBe(true);
    expect(gameTimestampSchema.safeParse({ day: -1, time: '09:00' }).success).toBe(false);
    expect(gameTimestampSchema.safeParse({ day: 1, time: '25:00' }).success).toBe(false);
  });

  it('rejects non HH:mm time strings', () => {
    expect(timeStringSchema.safeParse('9:00').success).toBe(false);
    expect(timeStringSchema.safeParse('09:60').success).toBe(false);
  });

  it('validates numeric ranges and conditions', () => {
    expect(numericRangeSchema.safeParse({ min: 0, max: 10 }).success).toBe(true);
    expect(numericRangeSchema.safeParse({ min: 10, max: 0 }).success).toBe(false);
    expect(numericConditionSchema.safeParse({ min: 20 }).success).toBe(true);
    expect(numericConditionSchema.safeParse({ min: 20, max: 10 }).success).toBe(false);
  });

  it('keeps schema version literal frozen', () => {
    expect(schemaVersionSchema.safeParse('0.1.0').success).toBe(true);
    expect(schemaVersionSchema.safeParse('0.2.0').success).toBe(false);
  });

  it('freezes event type and rarity vocabularies', () => {
    expect(eventTypeSchema.safeParse('social').success).toBe(true);
    expect(eventTypeSchema.safeParse('battle').success).toBe(false);
    expect(eventRaritySchema.safeParse('legendary').success).toBe(true);
    expect(eventRaritySchema.safeParse('mythic').success).toBe(false);
  });
});
