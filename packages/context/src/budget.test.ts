import { describe, expect, it } from 'vitest';
import { allocateContextBudget } from './budget.js';

describe('ContextBudget', () => {
  it('allocates the documented 80-capacity example exactly', () => {
    expect(allocateContextBudget(80)).toEqual({
      capacity: 80,
      systemRules: 15,
      currentState: 15,
      recentEvents: 20,
      memories: 20,
      internalState: 10,
    });
  });

  it('never exceeds capacity for arbitrary sizes', () => {
    for (const capacity of [1, 2, 5, 17, 33, 50, 79, 100]) {
      const budget = allocateContextBudget(capacity);
      const total =
        budget.systemRules +
        budget.currentState +
        budget.recentEvents +
        budget.memories +
        budget.internalState;
      expect(total).toBeLessThanOrEqual(capacity);
    }
  });
});
