import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { generateReaction } from './reaction-generator.js';
import { makeNarrativeContext, makeNarrativeGameState, reactionJson } from './test-data.js';

describe('ReactionGenerator', () => {
  it('consumes a valid dual-channel NPC reaction', async () => {
    const context = makeNarrativeContext();
    const state = makeNarrativeGameState();
    const option = {
      id: 'option_test',
      presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
      behavior: { actions: ['support'], intent: ['care'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: { affection: { base: 2 } },
      conditions: {},
      generation: {
        must_fit_character: true,
        must_fit_context: true,
        variation: 'medium' as const,
      },
    };
    const result = await generateReaction(
      context,
      state,
      option,
      TestProvider.fromText(reactionJson),
    );
    expect(result.source).toBe('llm');
    expect(result.narrative).toContain('嗯');
    expect(result.structured.emotion?.intensity).toBe(70);
  });

  it('falls back when structured channel is illegal', async () => {
    const context = makeNarrativeContext();
    const state = makeNarrativeGameState();
    const option = {
      id: 'option_test',
      presentation: { text: 'x', tone: 'neutral' },
      behavior: { actions: ['chat'], intent: ['connect'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: {},
      conditions: {},
      generation: {
        must_fit_character: true,
        must_fit_context: true,
        variation: 'medium' as const,
      },
    };
    const result = await generateReaction(
      context,
      state,
      option,
      TestProvider.fromText('{"narrative":""}'),
      { maxAttempts: 1 },
    );
    expect(result.source).toBe('fallback');
    expect(result.narrative.length).toBeGreaterThan(0);
  });
});
