import { describe, expect, it } from 'vitest';
import { optionSchema } from '@ag/schemas';
import { planDiverseOptions } from './planner.js';
import { renderOptions } from './renderer.js';
import { classifyOption, validateOptions } from './validator.js';

describe('Option Planner / Renderer / Validator', () => {
  it('plans and renders four diverse categories', () => {
    const plans = planDiverseOptions(4);
    const options = renderOptions(plans);
    expect(options).toHaveLength(4);
    for (const option of options) {
      expect(optionSchema.safeParse(option).success).toBe(true);
    }
    expect(validateOptions(options).valid).toBe(true);
    const categories = new Set(options.flatMap((option) => classifyOption(option)));
    expect(categories).toEqual(new Set(['active', 'conservative', 'social', 'risk']));
  });

  it('supports more than four options by cycling templates with unique ids', () => {
    const options = renderOptions(planDiverseOptions(6));
    expect(options).toHaveLength(6);
    expect(new Set(options.map((option) => option.id)).size).toBe(6);
  });
});
