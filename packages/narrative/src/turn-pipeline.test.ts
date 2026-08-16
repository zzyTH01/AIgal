import { describe, expect, it } from 'vitest';
import { finalStateDeltaSchema } from '@ag/schemas';
import { cloneGameState } from '@ag/core';
import { TestProvider } from '@ag/llm';
import { runNarrativeTurn } from './turn-pipeline.js';
import { makeNarrativeContext, optionPlansJson, reactionJson, scenarioJson } from './test-data.js';

describe('Narrative turn pipeline', () => {
  it('runs Scenario → Options → Choice → Reaction with TestProvider fixtures', async () => {
    const context = makeNarrativeContext();
    const state = cloneGameState(context.currentState);
    const provider = TestProvider.fromText(scenarioJson, optionPlansJson, reactionJson);

    const result = await runNarrativeTurn(context, state, provider);

    expect(result.scenario.source).toBe('llm');
    expect(result.options).toHaveLength(4);
    expect(result.selectedOption).toBe(result.options[0]);
    expect(result.reaction.source).toBe('llm');
    expect(finalStateDeltaSchema.safeParse(result.resolution.directDelta).success).toBe(true);
    expect(provider.calls).toHaveLength(3);
    // Narrative 层不直接改 GameState。
    expect(state).toEqual(context.currentState);
  });
});
