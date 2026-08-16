import { describe, expect, it } from 'vitest';
import { optionSchema } from './option.js';
import { makeOption } from './test-data.js';

describe('Option schema', () => {
  it('accepts a valid Behavior Object', () => {
    expect(optionSchema.safeParse(makeOption()).success).toBe(true);
  });

  it('rejects empty actions/intent arrays', () => {
    const option = makeOption();
    option.behavior.actions = [];
    expect(optionSchema.safeParse(option).success).toBe(false);
  });

  it('rejects risk outside 0~1', () => {
    const option = makeOption();
    option.behavior.risk = 1.5;
    expect(optionSchema.safeParse(option).success).toBe(false);
  });

  it('accepts scalar and numeric range conditions', () => {
    const option = makeOption();
    option.conditions = { flag_met: true, affection: { min: 10, max: 80 } };
    expect(optionSchema.safeParse(option).success).toBe(true);
  });

  it('rejects unknown variation and progress negative', () => {
    const option = makeOption();
    option.generation.variation = 'extreme' as never;
    expect(optionSchema.safeParse(option).success).toBe(false);

    option.generation.variation = 'high';
    option.gameplay.progress = -1;
    expect(optionSchema.safeParse(option).success).toBe(false);
  });
});
