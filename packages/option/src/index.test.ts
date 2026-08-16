import { describe, expect, it } from 'vitest';
import { planDiverseOptions, renderOptions } from './index.js';

describe('@ag/option package entry', () => {
  it('plans and renders options', () => {
    const options = renderOptions(planDiverseOptions(4));
    expect(options).toHaveLength(4);
  });
});
