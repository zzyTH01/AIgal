import { describe, expect, it } from 'vitest';
import type { EventDefinition } from '@ag/schemas';
import { createSeededRng } from './rng-service.js';
import { isEventEligible, rankEvents, selectEvent, trySelectEvent } from './event-selection.js';
import { makeEventDefinition, makeWorldGameState } from './test-data.js';

describe('event selection', () => {
  it('filters by conditions, location and required characters', () => {
    const state = makeWorldGameState();
    const definitions: EventDefinition[] = [
      makeEventDefinition({
        eventId: 'event_clear',
        conditions: { 'world.weather.type': 'clear' },
      }),
      makeEventDefinition({
        eventId: 'event_rain',
        conditions: { 'world.weather.type': 'rain' },
      }),
      makeEventDefinition({ eventId: 'event_rooftop', allowedLocationIds: ['loc_rooftop'] }),
      makeEventDefinition({
        eventId: 'event_with_mio',
        requiresCharacterIds: ['char_mio'],
      }),
      makeEventDefinition({
        eventId: 'event_missing_char',
        requiresCharacterIds: ['char_missing'],
      }),
      makeEventDefinition({
        eventId: 'event_acquaintance',
        requiresRelationshipType: 'acquaintance',
      }),
      makeEventDefinition({
        eventId: 'event_partner',
        requiresRelationshipType: 'partner',
      }),
    ];

    expect(isEventEligible(state, definitions[0]!)).toBe(true);
    expect(isEventEligible(state, definitions[1]!)).toBe(false);
    expect(isEventEligible(state, definitions[2]!)).toBe(false);
    expect(isEventEligible(state, definitions[3]!)).toBe(true);
    expect(isEventEligible(state, definitions[4]!)).toBe(false);
    expect(isEventEligible(state, definitions[5]!)).toBe(true);
    expect(isEventEligible(state, definitions[6]!)).toBe(false);
  });

  it('respects day and turn cooldowns', () => {
    const state = makeWorldGameState();
    const dayCooldown = makeEventDefinition({
      eventId: 'event_day_cooldown',
      cooldown: { days: 2, turns: 0 },
    });
    const turnCooldown = makeEventDefinition({
      eventId: 'event_turn_cooldown',
      cooldown: { days: 0, turns: 3 },
    });

    state.world.publicEvents = [
      {
        eventId: dayCooldown.eventId,
        type: dayCooldown.type,
        rarity: dayCooldown.rarity,
        title: dayCooldown.title,
        description: dayCooldown.description,
        weight: dayCooldown.baseWeight,
        lastTriggeredDay: 1,
      },
    ];
    expect(isEventEligible(state, dayCooldown)).toBe(false);
    state.run.day = 3;
    expect(isEventEligible(state, dayCooldown)).toBe(true);

    state.run.day = 1;
    state.run.turn = 3;
    expect(
      isEventEligible(state, turnCooldown, { lastTriggeredTurns: { event_turn_cooldown: 0 } }),
    ).toBe(true);
    expect(
      isEventEligible(state, turnCooldown, { lastTriggeredTurns: { event_turn_cooldown: 1 } }),
    ).toBe(false);
  });

  it('rarity multiplier increases score for rarer events', () => {
    const state = makeWorldGameState();
    const common = makeEventDefinition({ eventId: 'common', rarity: 'common', baseWeight: 10 });
    const rare = makeEventDefinition({ eventId: 'rare', rarity: 'rare', baseWeight: 10 });

    const commonCandidate = rankEvents(state, [common], createSeededRng(1))[0]!;
    const rareCandidate = rankEvents(state, [rare], createSeededRng(1))[0]!;
    expect(rareCandidate.rarityMultiplier).toBeGreaterThan(commonCandidate.rarityMultiplier);
    expect(rareCandidate.score).toBeGreaterThan(commonCandidate.score);
  });

  it('replays the same event selection for the same seed', () => {
    const state = makeWorldGameState();
    const definitions = [0, 1, 2].map((index) =>
      makeEventDefinition({ eventId: `event_${index}`, baseWeight: 1 }),
    );

    const run = (seed: number) =>
      Array.from(
        { length: 100 },
        () => selectEvent(state, definitions, createSeededRng(seed)).eventId,
      );
    expect(run(123)).toEqual(run(123));
    expect(run(456)).toEqual(run(456));
  });

  it('changes distribution when weights are reversed', () => {
    const state = makeWorldGameState();
    const light = makeEventDefinition({ eventId: 'event_light', baseWeight: 1 });
    const heavy = makeEventDefinition({ eventId: 'event_heavy', baseWeight: 9 });

    const count = (definitions: EventDefinition[]) => {
      const rng = createSeededRng(2026);
      let heavyHits = 0;
      for (let index = 0; index < 1000; index += 1) {
        if (selectEvent(state, definitions, rng).eventId === 'event_heavy') heavyHits += 1;
      }
      return heavyHits;
    };

    const first = count([light, heavy]);
    const second = count([
      makeEventDefinition({ eventId: 'event_light', baseWeight: 9 }),
      makeEventDefinition({ eventId: 'event_heavy', baseWeight: 1 }),
    ]);
    expect(first).toBeGreaterThan(700);
    expect(second).toBeLessThan(300);
    expect(first).toBeGreaterThan(second);
  });

  it('returns undefined when no event is eligible', () => {
    const state = makeWorldGameState();
    const impossible = makeEventDefinition({
      eventId: 'impossible',
      conditions: { 'run.day': { min: 99 } },
    });
    expect(trySelectEvent(state, [impossible], createSeededRng(1))).toBeUndefined();
    expect(() => selectEvent(state, [impossible], createSeededRng(1))).toThrow();
  });
});
