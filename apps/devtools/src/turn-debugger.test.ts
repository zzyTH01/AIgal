import { describe, expect, it } from 'vitest';
import { simulateRun } from './simulation-engine.js';
import { TurnDebugger } from './turn-debugger.js';

describe('Turn Debugger', () => {
  it('exposes full turn lifecycle data for a turnId', () => {
    const run = simulateRun(42, 5, [], {});
    const turn = run.turnResults[0]!;
    const debuggerTool = new TurnDebugger(run.turnResults);
    expect(debuggerTool.list()).toContain(turn.turnId);

    const view = debuggerTool.debug(turn.turnId);
    expect(view.choiceOptionId).toBe(turn.choice.optionId);
    expect(view.stateBefore.run.turn).toBe(turn.stateBefore.run.turn);
    expect(view.directDelta.relationships).toBeDefined();
    expect(view.finalState.run.turn).toBeGreaterThan(view.stateBefore.run.turn);
  });
});
