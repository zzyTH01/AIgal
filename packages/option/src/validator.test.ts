import { describe, expect, it } from 'vitest';
import { planDiverseOptions } from './planner.js';
import { renderOptions } from './renderer.js';
import { validateOptions } from './validator.js';
import { createGameState } from '@ag/core';

describe('OptionValidator', () => {
  it('accepts four diverse options that satisfy conditions', () => {
    const state = createGameState({ runId: 'run_001' });
    const options = renderOptions(planDiverseOptions(4));
    expect(validateOptions(options, { gameState: state }).valid).toBe(true);
  });

  it('rejects condition-unmet options against GameState', () => {
    const state = createGameState({ runId: 'run_001' });
    const options = renderOptions(planDiverseOptions(4));
    options[0]!.conditions = { 'run.day': { min: 99 } };
    const result = validateOptions(options, { gameState: state });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'condition_unmet')).toBe(true);
  });

  it('rejects missing diversity and duplicate behavior signatures', () => {
    const options = renderOptions(planDiverseOptions(4));
    options[1] = { ...options[0]!, id: 'option_active_2' };
    options[2] = { ...options[0]!, id: 'option_active_3' };
    const result = validateOptions(options);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'duplicate_behavior')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'diversity_missing')).toBe(true);
  });

  it('rejects forbidden actions for character consistency', () => {
    const options = renderOptions(planDiverseOptions(4));
    const result = validateOptions(options, { forbiddenActions: ['approach'] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'character_inconsistent')).toBe(true);
  });
});
