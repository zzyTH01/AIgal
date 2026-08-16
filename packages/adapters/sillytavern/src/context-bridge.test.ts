import { describe, expect, it } from 'vitest';
import { applyStPromptSections, modelContextToStPrompt, parseStPrompt } from './context-bridge.js';
import { makeContext } from './test-data.js';

describe('Context Bridge', () => {
  it('maps ModelContext to ST Prompt and parses sections back', () => {
    const context = makeContext();
    const prompt = modelContextToStPrompt(context);
    expect(prompt).toContain('[System]');
    expect(prompt).toContain('[Current State]');
    expect(prompt).toContain('affection=30');

    const sections = parseStPrompt(prompt);
    expect(sections.systemRules).toContain('图书管理员');
    expect(sections.task).toContain('generate_scenario');

    const restored = applyStPromptSections(context, sections);
    expect(restored.systemRules).toContain('图书管理员');
    expect(restored.generationTask.task).toContain('generate_scenario');
  });
});
