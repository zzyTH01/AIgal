import { describe, expect, it } from 'vitest';
import { parseStructuredResponse } from './index.js';
import { generatedScenarioSchema } from './scenario.js';

describe('@ag/narrative package entry', () => {
  it('exports structured JSON parsing', () => {
    expect(
      parseStructuredResponse(
        JSON.stringify({ narrative: 'hi', structured: {} }),
        generatedScenarioSchema,
      ).narrative,
    ).toBe('hi');
  });
});
