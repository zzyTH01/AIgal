import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { generateScenario } from './scenario-generator.js';
import { makeNarrativeContext, scenarioJson } from './test-data.js';

describe('ScenarioGenerator', () => {
  it('consumes a valid dual-channel scenario', async () => {
    const context = makeNarrativeContext();
    const result = await generateScenario(context, TestProvider.fromText(scenarioJson));
    expect(result.source).toBe('llm');
    expect(result.narrative).toContain('图书馆');
    expect(result.structured.emotion?.intensity).toBe(30);
  });

  it('retries invalid JSON and then accepts valid JSON', async () => {
    const provider = TestProvider.fromText('not-json', scenarioJson);
    const result = await generateScenario(makeNarrativeContext(), provider, { maxAttempts: 1 });
    expect(result.source).toBe('llm');
    expect(provider.calls).toHaveLength(2);
  });

  it('falls back when JSON is valid but numeric values are illegal', async () => {
    const provider = TestProvider.fromText(
      JSON.stringify({
        narrative: 'x',
        structured: { emotion: { type: 'anger', intensity: 500 } },
      }),
    );
    const result = await generateScenario(makeNarrativeContext(), provider, { maxAttempts: 1 });
    expect(result.source).toBe('fallback');
    expect(result.narrative.length).toBeGreaterThan(0);
  });
});
