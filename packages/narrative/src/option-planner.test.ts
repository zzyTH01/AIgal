import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { planAndRenderOptions } from './option-planner.js';
import { makeNarrativeContext, optionPlansJson } from './test-data.js';

describe('Narrative OptionPlanner', () => {
  it('accepts valid LLM planned options and renders them', async () => {
    const provider = TestProvider.fromText(optionPlansJson);
    const result = await planAndRenderOptions(makeNarrativeContext(), provider);
    expect(result.source).toBe('llm');
    expect(result.options).toHaveLength(4);
    expect(result.options[0]?.presentation.text).toBe('需要我帮忙吗？');
  });

  it('falls back to diverse deterministic plans on invalid LLM output', async () => {
    const provider = TestProvider.fromText('not-json');
    const result = await planAndRenderOptions(makeNarrativeContext(), provider, { maxAttempts: 1 });
    expect(result.source).toBe('fallback');
    expect(result.options).toHaveLength(4);
    expect(provider.calls).toHaveLength(2);
  });

  it('rejects an LLM plan with fewer than four options', async () => {
    const oneOption = JSON.stringify([JSON.parse(optionPlansJson)[0]]);
    const provider = TestProvider.fromText(oneOption);
    const result = await planAndRenderOptions(makeNarrativeContext(), provider, { maxAttempts: 1 });
    expect(result.source).toBe('fallback');
    expect(result.options).toHaveLength(4);
  });
});
