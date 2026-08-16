import { describe, expect, it } from 'vitest';
import { fingerprint, simulateRun, simulateRuns } from './simulation-engine.js';

describe('Simulation Engine', () => {
  it('runs batch simulations with bounded and stable statistics', () => {
    const report = simulateRuns({ runs: 10, turnsPerRun: 20, seedBase: 500 });
    expect(report.runs).toBe(10);
    expect(report.completedTurns).toBeGreaterThan(0);
    expect(report.avgDay).toBeGreaterThanOrEqual(1);
    expect(report.avgTurn).toBeGreaterThanOrEqual(1);
    expect(report.avgAffection).toBeGreaterThanOrEqual(0);
    expect(report.avgAffection).toBeLessThanOrEqual(100);
    expect(report.avgMemoryRecords).toBeLessThanOrEqual(100);
    expect(report.avgContextMemories).toBeLessThanOrEqual(5);
    expect(report.optionFrequency).not.toEqual({});
    expect(report.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('replay is deterministic for the same seed', () => {
    const a = simulateRuns({ runs: 3, turnsPerRun: 30, seedBase: 900 });
    const b = simulateRuns({ runs: 3, turnsPerRun: 30, seedBase: 900 });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(fingerprint(a)).toBe(a.fingerprint);
  });

  it('controls context explosion with memory pruning on long runs', () => {
    const run = simulateRun(2026, 200, [], { maxMemoryRecords: 25 });
    const state = run.turnResults[run.turnResults.length - 1]!.finalState;
    expect(Object.keys(state.memories.records).length).toBeLessThanOrEqual(25);
    expect(run.contextBudget).toBeGreaterThan(0);
    expect(run.contextMemories).toBeLessThanOrEqual(5);
  });

  it('single-run turn history is valid and replayable', () => {
    const run = simulateRun(777, 12, [], {});
    expect(run.turnResults.length).toBeGreaterThan(0);
    expect(run.turnResults[0]!.turnId).toContain('run_777');
  });
});
