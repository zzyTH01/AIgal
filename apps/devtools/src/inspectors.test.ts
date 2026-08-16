import { describe, expect, it } from 'vitest';
import { buildContext } from '@ag/context';
import { simulateRun } from './simulation-engine.js';
import { inspectContext, inspectMemory, inspectState } from './inspectors.js';

describe('Inspectors', () => {
  it('inspects state, memory and context', () => {
    const run = simulateRun(123, 8, [], {});
    const state = run.turnResults[run.turnResults.length - 1]!.finalState;

    const stateView = inspectState(state);
    expect(stateView.day).toBeGreaterThanOrEqual(1);
    expect(stateView.characters).toContain('阿尔托莉雅・潘德拉贡');
    expect(stateView.memoryRecords).toBeLessThanOrEqual(100);

    const memoryView = inspectMemory(state);
    expect(memoryView.records).toBe(stateView.memoryRecords);
    expect(memoryView.avgStrength).toBeGreaterThanOrEqual(0);

    const context = buildContext(state, { characterId: 'char_mio' });
    const contextView = inspectContext(context);
    expect(contextView.budgetUsed).toBeLessThanOrEqual(contextView.budgetCapacity);
  });
});
