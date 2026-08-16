import { describe, expect, it } from 'vitest';
import { modelContextSchema } from '@ag/schemas';
import { TestProvider } from '@ag/llm';
import { buildContext } from './context-builder.js';
import { composePrompt } from './composer.js';
import { makeContextGameState, makeEventInstance, makeMemory } from './test-data.js';

describe('ContextBuilder', () => {
  it('builds a valid ModelContext with retrieved memories and current event', () => {
    const state = makeContextGameState();
    state.memories.records.mem_1 = makeMemory();
    state.memories.shortTermIds.push('mem_1');

    const context = buildContext(state, {
      currentEvent: makeEventInstance(),
      query: { tags: ['rain', 'help'], text: '雨天 帮助' },
    });
    expect(modelContextSchema.safeParse(context).success).toBe(true);
    expect(context.retrievedMemories).toHaveLength(1);
    expect(context.retrievedMemories[0]?.id).toBe('mem_1');
    expect(context.budget.capacity).toBe(80);
  });

  it('produces different contexts for forgetful vs strong-memory cognition profiles', () => {
    const forgetful = makeContextGameState();
    forgetful.characters.char_mio!.cognition = {
      ...forgetful.characters.char_mio!.cognition,
      memoryCapacity: 20,
      retrieval: 20,
      forgetfulness: 80,
    };
    const strong = makeContextGameState();
    strong.characters.char_mio!.cognition.memoryCapacity = 100;
    strong.characters.char_mio!.cognition.retrieval = 90;

    const forgetfulContext = buildContext(forgetful, { query: { tags: ['rain'] } });
    const strongContext = buildContext(strong, { query: { tags: ['rain'] } });
    expect(forgetfulContext.budget.capacity).toBe(20);
    expect(strongContext.budget.capacity).toBe(100);
    expect(forgetfulContext.retrievedMemories.length).toBeLessThanOrEqual(
      strongContext.retrievedMemories.length,
    );
  });

  it('Memory → Context → LLM(fixture) chain includes retrieved memory in prompt', async () => {
    const state = makeContextGameState();
    state.memories.records.mem_1 = makeMemory();
    state.memories.shortTermIds.push('mem_1');
    const context = buildContext(state, { query: { tags: ['rain'] } });
    const prompt = composePrompt(context);
    const provider = TestProvider.fromText('fixture-ok');
    const response = await provider.generate({ messages: [{ role: 'user', content: prompt }] });
    expect(response.text).toBe('fixture-ok');
    expect(provider.calls[0]?.messages[0]?.content).toContain('玩家曾在雨天帮 Mio 整理旧报刊');
  });
});
