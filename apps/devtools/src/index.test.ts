import { describe, expect, it } from 'vitest';
import { simulateRuns } from './index.js';

describe('@ag/devtools package entry', () => {
  it('exports a working simulation engine', () => {
    const report = simulateRuns({ runs: 2, turnsPerRun: 10 });
    expect(report.runs).toBe(2);
  });
});
