import { describe, expect, it } from 'vitest';
import {
  addDailyProgress,
  advanceDay,
  dailyProgressRatio,
  isDayComplete,
} from './progress-engine.js';
import { makeCoreGameState } from './test-data.js';

describe('ProgressEngine', () => {
  it('adds progress below limit without crossing day', () => {
    const state = makeCoreGameState();
    const result = addDailyProgress(state, 5);
    expect(result.crossedDayBoundary).toBe(false);
    expect(result.state.run.dailyProgress).toBe(5);
    expect(result.state.run.day).toBe(1);
  });

  it('crosses day boundary, resets progress and advances weekday/time', () => {
    const state = makeCoreGameState();
    state.run.dailyProgress = 10;
    const result = addDailyProgress(state, 2);
    expect(result.crossedDayBoundary).toBe(true);
    expect(result.state.run.day).toBe(2);
    expect(result.state.run.dailyProgress).toBe(0);
    expect(result.state.run.time).toBe('09:00');
    expect(result.state.world.day).toBe(2);
    expect(result.state.world.weekday).toBe('tuesday');
  });

  it('advances day directly', () => {
    const state = makeCoreGameState();
    const next = advanceDay(state, '08:00');
    expect(next.run.day).toBe(2);
    expect(next.world.time).toBe('08:00');
    expect(next.run.time).toBe('08:00');
  });

  it('clamps negative progress to zero and exposes ratio', () => {
    const state = makeCoreGameState();
    const result = addDailyProgress(state, -5);
    expect(result.state.run.dailyProgress).toBe(0);
    expect(isDayComplete(result.state)).toBe(false);
    expect(dailyProgressRatio(result.state)).toBe(0);
  });
});
