import type { GameState } from '@ag/schemas';
import { clamp, cloneGameState } from './game-state.js';

export interface DailyProgressResult {
  state: GameState;
  /** 本回合结束后是否达到 dailyProgressLimit 并切到新的一天。 */
  crossedDayBoundary: boolean;
  previousDay: number;
  nextDay: number;
}

/**
 * 推进 Daily Progress；若达到上限，立即触发 Day End 的 Phase 2 简化版本：
 * Daily Summary/Memory Consolidation/Ending Check 在后续 Phase 接入，
 * 这里只做最硬的两件事：进度清零 + Day + 1 + 时间重置。
 */
export function addDailyProgress(
  state: GameState,
  amount: number,
  nextDayStartTime = '09:00',
): DailyProgressResult {
  const previousDay = state.run.day;
  const before = state.run.dailyProgress;
  const limit = state.run.dailyProgressLimit;
  const next = cloneGameState(state);

  const reached = clamp(before + amount, 0, limit);
  const crossed = before < limit && reached >= limit;

  next.run.dailyProgress = reached;

  if (!crossed) {
    return { state: next, crossedDayBoundary: false, previousDay, nextDay: previousDay };
  }

  const advanced = advanceDay(next, nextDayStartTime);
  return {
    state: advanced,
    crossedDayBoundary: true,
    previousDay,
    nextDay: advanced.run.day,
  };
}

export function advanceDay(state: GameState, nextDayStartTime = '09:00'): GameState {
  const next = cloneGameState(state);
  next.run.day += 1;
  next.run.dailyProgress = 0;
  next.run.time = nextDayStartTime;

  next.world.day = next.run.day;
  next.world.time = next.run.time;
  next.world.weekday = weekdayAfter(next.world.weekday, 1);
  return next;
}

export const DEFAULT_TURN_TIME_STEP_MINUTES = 30;
const MAX_TIME_MINUTES = 23 * 60 + 59;

/**
 * 日内时间推进的唯一权威路径（P0 Transition 前置契约）：
 * 每 Turn 推进 stepMinutes，23:59 封顶等待跨天（Day 结束仍由 DailyProgress 驱动）。
 * 同时写 run.time 与 world.time。
 */
export function advanceIntradayTime(
  state: GameState,
  stepMinutes = DEFAULT_TURN_TIME_STEP_MINUTES,
): GameState {
  if (stepMinutes <= 0) return state;
  const next = cloneGameState(state);
  const parts = next.run.time.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const current =
    Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 9 * 60;
  const advanced = Math.min(MAX_TIME_MINUTES, current + Math.round(stepMinutes));
  const hh = Math.floor(advanced / 60)
    .toString()
    .padStart(2, '0');
  const mm = (advanced % 60).toString().padStart(2, '0');
  next.run.time = `${hh}:${mm}`;
  next.world.time = next.run.time;
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

function weekdayAfter(
  weekday: (typeof WEEKDAYS)[number],
  offset: number,
): (typeof WEEKDAYS)[number] {
  const index = (WEEKDAYS.indexOf(weekday) + offset) % WEEKDAYS.length;
  return WEEKDAYS[index] ?? 'monday';
}

export function isDayComplete(state: GameState): boolean {
  return state.run.dailyProgress >= state.run.dailyProgressLimit;
}

export function dailyProgressRatio(state: GameState): number {
  return state.run.dailyProgressLimit <= 0
    ? 0
    : clamp(state.run.dailyProgress / state.run.dailyProgressLimit, 0, 1);
}
