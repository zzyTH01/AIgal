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

  it('sanitizes messy LLM conditions instead of falling back', async () => {
    const parsed = JSON.parse(combinedJson);
    parsed.options[0].conditions = { 'relationship.trust': { min: 20, extra: 'ignore' } };
    parsed.options[1].conditions = { requires: ['friend'], mood: null };
    parsed.options[2].conditions = { 'run.day': { min: 1, extra: true } };
    const provider = TestProvider.fromText(JSON.stringify(parsed));
    const result = await generateScenarioAndOptions(makeNarrativeContext(), provider);
    expect(result.source).toBe('llm');
    expect(result.options).toHaveLength(4);
    expect(result.options[0]?.conditions).toEqual({ 'relationship.trust': { min: 20 } });
    expect(result.options[1]?.conditions).toEqual({});
  });

  it('keeps LLM options when diversity is incomplete (soft constraint)', async () => {
    const parsed = JSON.parse(combinedJson);
    parsed.options[1].behavior.actions = ['help', 'protect'];
    parsed.options[1].conditions = {};
    parsed.options[2].behavior.actions = ['initiate', 'lead'];
    parsed.options[2].conditions = {};
    parsed.options[3].behavior.actions = ['support', 'respect'];
    parsed.options[3].conditions = {};
    const provider = TestProvider.fromText(JSON.stringify(parsed));
    const result = await generateScenarioAndOptions(makeNarrativeContext(), provider);
    expect(result.source).toBe('llm');
    expect(result.options).toHaveLength(4);
  });

  it('establishes player POV and injects retrieved memories', async () => {
    const context = makeNarrativeContext();
    context.retrievedMemories = [
      {
        id: 'mem_rain',
        type: 'episodic',
        content: '玩家曾在雨天陪 Mio 整理旧报刊。',
        createdAt: { day: 1, time: '09:00' },
        importance: 70,
        emotionalIntensity: 60,
        valence: 25,
        strength: 80,
        accuracy: 90,
        tags: ['rain', 'help'],
        relatedCharacters: ['char_mio'],
        sourceTurnId: 'run_017/day_001/turn_001',
        retrievalCount: 0,
      },
    ];
    let captured = '';
    const provider = new TestProvider((request) => {
      captured = request.messages[1]?.content ?? '';
      return { text: combinedJson };
    });
    await generateScenarioAndOptions(context, provider);
    expect(captured).toContain('【角色定位】你是玩家');
    expect(captured).toContain('「Mio」');
    expect(captured).toContain('[检索记忆1]');
    expect(captured).toContain('玩家曾在雨天陪 Mio 整理旧报刊');
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
