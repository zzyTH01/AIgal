import { describe, expect, it } from 'vitest';
import { contextBudgetSchema, modelContextSchema } from './context.js';
import { makeModelContext } from './test-data.js';

describe('ModelContext schema', () => {
  it('accepts a valid ModelContext', () => {
    expect(modelContextSchema.safeParse(makeModelContext()).success).toBe(true);
  });

  it('rejects budget allocations that exceed capacity', () => {
    const context = makeModelContext();
    context.budget = {
      capacity: 80,
      systemRules: 30,
      currentState: 30,
      recentEvents: 20,
      memories: 20,
      internalState: 10,
    };
    expect(contextBudgetSchema.safeParse(context.budget).success).toBe(false);
    expect(modelContextSchema.safeParse(context).success).toBe(false);
  });

  it('rejects zero capacity budget', () => {
    const context = makeModelContext();
    context.budget.capacity = 0;
    expect(modelContextSchema.safeParse(context).success).toBe(false);
  });
});
