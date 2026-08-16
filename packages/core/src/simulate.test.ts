import { describe, expect, it } from 'vitest';
import { validateGameState } from './game-state.js';
import { simulateNTurns } from './simulate.js';
import { makeCoreGameState, restOption, supportOption } from './test-data.js';

describe('simulateNTurns', () => {
  it('runs 50+ turns without breaking GameState', () => {
    const initial = makeCoreGameState();
    const result = simulateNTurns(initial, [supportOption, restOption], 50);
    expect(result.completedTurns).toBe(50);
    expect(result.ended).toBe(false);
    expect(result.finalState.run.turn).toBe(50);
    expect(result.finalState.run.day).toBeGreaterThan(1);
    expect(validateGameState(result.finalState).success).toBe(true);
    expect(initial.run.turn).toBe(0);
  });

  it('stops and applies the first triggered ending', () => {
    const initial = makeCoreGameState();
    const endings = [
      {
        endingId: 'ending_early',
        kind: 'normal' as const,
        title: 'Early End',
        description: '前五回合触发。',
        conditions: { 'run.turn': { min: 5 } },
        priority: 10,
      },
    ];
    const result = simulateNTurns(initial, [supportOption, restOption], 50, { endings });
    expect(result.completedTurns).toBe(5);
    expect(result.ended).toBe(true);
    expect(result.ending?.endingId).toBe('ending_early');
    expect(result.finalState.run.status).toBe('completed');
    expect(validateGameState(result.finalState).success).toBe(true);
  });

  it('throws when options list is empty or initial state invalid', () => {
    const initial = makeCoreGameState();
    expect(() => simulateNTurns(initial, [], 10)).toThrow();
    initial.schemaVersion = '0.0.1' as never;
    expect(() => simulateNTurns(initial, [supportOption], 10)).toThrow();
  });
});
