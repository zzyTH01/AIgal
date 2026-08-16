import { describe, expect, it } from 'vitest';
import { summarizeGameState } from './summarizer.js';
import { composePrompt } from './composer.js';
import { buildContext } from './context-builder.js';
import { makeContextGameState } from './test-data.js';

describe('StateSummarizer and PromptComposer', () => {
  it('summarizes characters, relationships and world', () => {
    const summary = summarizeGameState(makeContextGameState());
    expect(summary).toContain('Mio');
    expect(summary).toContain('affection 30');
    expect(summary).toContain('loc_start');
  });

  it('composes prompt sections from ModelContext', () => {
    const context = buildContext(makeContextGameState());
    const prompt = composePrompt(context);
    expect(prompt).toContain('[System]');
    expect(prompt).toContain('[Task]');
    expect(prompt).toContain('generate_scenario_and_options');
  });
});
