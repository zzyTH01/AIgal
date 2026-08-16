import type { GameState } from '@ag/schemas';
import { cloneGameState } from '@ag/core';
import type { RNG } from '@ag/core';

const SEASON_WEATHER: Record<string, Array<{ type: string; weight: number }>> = {
  spring: [
    { type: 'clear', weight: 5 },
    { type: 'cloudy', weight: 3 },
    { type: 'rain', weight: 2 },
  ],
  summer: [
    { type: 'clear', weight: 6 },
    { type: 'cloudy', weight: 2 },
    { type: 'storm', weight: 1 },
  ],
  autumn: [
    { type: 'cloudy', weight: 4 },
    { type: 'rain', weight: 3 },
    { type: 'wind', weight: 2 },
    { type: 'clear', weight: 2 },
  ],
  winter: [
    { type: 'snow', weight: 4 },
    { type: 'cloudy', weight: 3 },
    { type: 'clear', weight: 2 },
    { type: 'fog', weight: 1 },
  ],
};

export function evolveWeather(state: GameState, rng: RNG): GameState {
  const next = cloneGameState(state);
  const table = SEASON_WEATHER[state.world.season] ?? SEASON_WEATHER.spring!;
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let target = rng.next() * total;
  let type = 'clear';
  for (const entry of table) {
    target -= entry.weight;
    if (target <= 0) {
      type = entry.type;
      break;
    }
  }
  next.world.weather = {
    type,
    intensity: Math.round(10 + rng.next() * 60),
    temperature:
      state.world.season === 'summer'
        ? 24 + Math.round(rng.next() * 10)
        : state.world.season === 'winter'
          ? -2 + Math.round(rng.next() * 8)
          : 10 + Math.round(rng.next() * 12),
    visibility: Math.round(50 + rng.next() * 50),
  };
  return next;
}

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export function advanceCalendar(state: GameState, days = 1): GameState {
  const next = cloneGameState(state);
  const currentIndex = WEEKDAYS.indexOf(next.world.weekday);
  next.world.weekday = WEEKDAYS[(currentIndex + days) % WEEKDAYS.length] ?? 'monday';
  const nextDay = next.world.day + days;
  next.world.day = nextDay;
  next.run.day = nextDay;
  const dayOfYear = Math.max(0, nextDay - 1) % 360;
  next.world.season = SEASONS[Math.floor(dayOfYear / 90)] ?? 'spring';
  return next;
}

export interface NpcScheduleEntry {
  weekday: (typeof WEEKDAYS)[number];
  time: string;
  activity: string;
  locationId: string;
  availability: number;
  status?: 'active' | 'unavailable' | 'absent' | 'asleep' | 'disabled';
}

export function applyNpcSchedule(
  state: GameState,
  characterId: string,
  schedule: readonly NpcScheduleEntry[],
  weekday: (typeof WEEKDAYS)[number],
  time: string,
): GameState {
  const next = cloneGameState(state);
  const character = next.characters[characterId];
  if (!character) return next;
  const entry = schedule.find((item) => item.weekday === weekday && item.time <= time);
  if (entry) {
    character.activity.locationId = entry.locationId;
    character.activity.activity = entry.activity;
    character.activity.availability = entry.availability;
    if (entry.status) character.status = entry.status;
  }
  return next;
}

export interface WorldEvolutionOptions {
  days?: number;
  schedule?: readonly NpcScheduleEntry[];
  characterId?: string;
}

export function evolveWorld(
  state: GameState,
  rng: RNG,
  options: WorldEvolutionOptions = {},
): GameState {
  let next = advanceCalendar(state, options.days ?? 1);
  next = evolveWeather(next, rng);
  if (options.characterId && options.schedule) {
    next = applyNpcSchedule(
      next,
      options.characterId,
      options.schedule,
      next.world.weekday,
      next.world.time,
    );
  }
  next.world.currentLocationId = next.run.currentLocationId;
  return next;
}
