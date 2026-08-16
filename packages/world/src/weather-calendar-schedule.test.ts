import { describe, expect, it } from 'vitest';
import { createGameState } from '@ag/core';
import { XorShift128Rng } from './rng-service.js';
import {
  advanceCalendar,
  applyNpcSchedule,
  evolveWeather,
  evolveWorld,
} from './weather-calendar-schedule.js';

describe('Weather / Calendar / NPC schedule', () => {
  it('advances weekday and season', () => {
    const state = createGameState({ day: 1 });
    const next = advanceCalendar(state, 90);
    expect(next.world.weekday).not.toBe(state.world.weekday);
    expect(next.world.day).toBe(91);
    expect(next.world.season).toBe('summer');
  });

  it('evolves weather deterministically for the same seed', () => {
    const base = createGameState({ day: 1 });
    const a = evolveWeather(base, new XorShift128Rng(42));
    const b = evolveWeather(base, new XorShift128Rng(42));
    expect(a.world.weather).toEqual(b.world.weather);
  });

  it('applies NPC schedule and world evolution', () => {
    const state = createGameState({ day: 1, time: '09:00' });
    const scheduled = applyNpcSchedule(
      state,
      'char_test',
      [
        {
          weekday: 'monday',
          time: '09:00',
          activity: 'work',
          locationId: 'loc_start',
          availability: 20,
          status: 'unavailable',
        },
      ],
      'monday',
      '10:00',
    );
    expect(scheduled.characters.char_test).toBeUndefined(); // no char in fixture
    const withChar = structuredClone(state);
    withChar.characters.char_test = structuredClone(
      Object.values(withChar.characters)[0] ??
        ({
          characterId: 'char_test',
          identity: {
            name: 'x',
            age: 18,
            gender: 'x',
            genderIdentity: 'x',
            sexualOrientation: 'x',
            role: 'x',
            description: '',
          },
          personality: {
            traits: {},
            independence: 50,
            confidence: 50,
            sociability: 50,
            sensitivity: 50,
            assertiveness: 50,
            empathy: 50,
            openness: 50,
          },
          psychology: {
            dependence: 50,
            security: 50,
            loneliness: 50,
            stress: 50,
            jealousy: 50,
            selfWorth: 50,
            emotionalStability: 50,
            romanticTension: 50,
          },
          emotion: { primary: 'neutral', intensity: 30, valence: 0, energy: 50 },
          cognition: {
            memoryCapacity: 80,
            encoding: 60,
            retention: 60,
            retrieval: 60,
            forgetfulness: 30,
            grudge: 30,
            obsession: 30,
            attention: 60,
            emotionalSalience: 60,
            cognitiveLoad: 30,
          },
          physical: { energy: 70, fatigue: 20, health: 90, hunger: 20, sleepiness: 10 },
          activity: { locationId: 'loc_start', activity: 'idle', availability: 100 },
          status: 'active',
        } as never),
    );
    const applied = applyNpcSchedule(
      withChar,
      'char_test',
      [
        {
          weekday: 'monday',
          time: '09:00',
          activity: 'work',
          locationId: 'loc_start',
          availability: 20,
          status: 'unavailable',
        },
      ],
      'monday',
      '10:00',
    );
    expect(applied.characters.char_test?.status).toBe('unavailable');
    expect(applied.characters.char_test?.activity.availability).toBe(20);
  });

  it('evolveWorld combines calendar, weather and schedule', () => {
    const state = createGameState({ day: 1 });
    const next = evolveWorld(state, new XorShift128Rng(7), { days: 2 });
    expect(next.world.day).toBe(3);
    expect(next.world.weather.intensity).toBeGreaterThanOrEqual(0);
  });
});
