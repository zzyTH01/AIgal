import { describe, expect, it } from 'vitest';
import {
  eventCandidateSchema,
  eventDefinitionSchema,
  eventInstanceSchema,
  eventResultSchema,
} from './event.js';
import { makeEventDefinition, makeEventInstance, makeEventResult } from './test-data.js';

describe('Event schemas', () => {
  it('accepts valid EventDefinition / Instance / Result / Candidate', () => {
    expect(eventDefinitionSchema.safeParse(makeEventDefinition()).success).toBe(true);
    expect(eventInstanceSchema.safeParse(makeEventInstance()).success).toBe(true);
    expect(eventResultSchema.safeParse(makeEventResult()).success).toBe(true);
    expect(
      eventCandidateSchema.safeParse({
        eventId: 'event_rainy_library',
        eligible: true,
        baseWeight: 10,
        contextModifier: 1,
        characterModifier: 1.2,
        relationshipModifier: 0.9,
        randomFactor: 0.8,
        score: 8.64,
      }).success,
    ).toBe(true);
  });

  it('rejects negative baseWeight and negative cooldown', () => {
    const event = makeEventDefinition();
    event.baseWeight = -1;
    expect(eventDefinitionSchema.safeParse(event).success).toBe(false);

    event.baseWeight = 10;
    event.cooldown.days = -1;
    expect(eventDefinitionSchema.safeParse(event).success).toBe(false);
  });

  it('rejects invalid instance status', () => {
    const instance = makeEventInstance();
    instance.status = 'paused' as never;
    expect(eventInstanceSchema.safeParse(instance).success).toBe(false);
  });
});
