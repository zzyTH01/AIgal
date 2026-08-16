import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { generateScenarioAndOptions } from './combined-generator.js';
import { combinedJson, makeNarrativeContext } from './test-data.js';

describe('combined Scenario + Options generation', () => {
  it('returns valid scenario and options in one LLM call', async () => {
    const provider = TestProvider.fromText(combinedJson);
    const result = await generateScenarioAndOptions(makeNarrativeContext(), provider);
    expect(result.source).toBe('llm');
    expect(result.scenario.narrative).toContain('图书馆');
    expect(result.options).toHaveLength(4);
    expect(provider.calls).toHaveLength(1);
  });

  it('falls back without calling LLM again after retries', async () => {
    const provider = TestProvider.fromText('not-json');
    const result = await generateScenarioAndOptions(makeNarrativeContext(), provider, {
      maxAttempts: 1,
    });
    expect(result.source).toBe('fallback');
    expect(result.options).toHaveLength(4);
    expect(result.scenario.narrative.length).toBeGreaterThan(0);
    expect(provider.calls).toHaveLength(2);
  });
});
