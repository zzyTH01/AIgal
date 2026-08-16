import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { generateScenario } from './scenario-generator.js';
import { makeNarrativeContext, scenarioJson } from './test-data.js';

describe('Narrative consistency check', () => {
  it('triggers fallback when forbidden topic is generated', async () => {
    const provider = TestProvider.fromText(
      JSON.stringify({ narrative: '突然出现了违规内容', structured: {} }),
    );
    const result = await generateScenario(makeNarrativeContext(), provider, {
      maxAttempts: 1,
      consistency: { forbiddenTopics: ['违规'] },
    });
    expect(result.source).toBe('fallback');
  });

  it('accepts consistent LLM scenario', async () => {
    const provider = TestProvider.fromText(scenarioJson);
    const result = await generateScenario(makeNarrativeContext(), provider, {
      consistency: { allowedCharacters: ['Mio'] },
    });
    expect(result.source).toBe('llm');
  });
});
