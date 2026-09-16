import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import { ALWAYS_SUCCESS_RNG, resolveChoice } from '@ag/core';
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

  it('injects resolution summary into the reaction prompt', async () => {
    const context = makeNarrativeContext();
    const state = makeNarrativeGameState();
    const option = {
      id: 'option_support',
      presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
      behavior: { actions: ['support'], intent: ['care'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: { affection: { base: 2 }, trust: { base: 1 } },
      conditions: {},
      generation: {
        must_fit_character: true,
        must_fit_context: true,
        variation: 'medium' as const,
      },
    };
    const resolution = resolveChoice(state, option, ALWAYS_SUCCESS_RNG);
    const provider = TestProvider.fromText(reactionJson);
    await generateReaction(context, state, option, provider, {}, resolution);
    expect(provider.calls[0]?.messages[1]?.content).toContain('结算结果');
    expect(provider.calls[0]?.messages[1]?.content).toContain('rel_player_mio.affection');
  });

  it('injects resolution summary into the reaction prompt', async () => {
    const context = makeNarrativeContext();
    const state = makeNarrativeGameState();
    const option = {
      id: 'option_support',
      presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
      behavior: { actions: ['support'], intent: ['care'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: { affection: { base: 2 }, trust: { base: 1 } },
      conditions: {},
      generation: {
        must_fit_character: true,
        must_fit_context: true,
        variation: 'medium' as const,
      },
    };
    const resolution = resolveChoice(state, option, ALWAYS_SUCCESS_RNG);
    const provider = TestProvider.fromText(reactionJson);
    await generateReaction(context, state, option, provider, {}, resolution);
    expect(provider.calls[0]?.messages[1]?.content).toContain('结算结果');
    expect(provider.calls[0]?.messages[1]?.content).toContain('rel_player_mio.affection');
  });

  it('injects retrieved memories and NPC POV into reaction prompt', async () => {
    const context = makeNarrativeContext();
    context.retrievedMemories = [
      {
        id: 'mem_1',
        type: 'episodic',
        content: '玩家上周说过会再来。',
        createdAt: { day: 1, time: '09:00' },
        importance: 60,
        emotionalIntensity: 40,
        valence: 10,
        strength: 70,
        accuracy: 90,
        tags: ['promise'],
        relatedCharacters: ['char_mio'],
        sourceTurnId: 'turn_1',
        retrievalCount: 0,
      },
    ];
    const state = makeNarrativeGameState();
    const option = {
      id: 'option_support',
      presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
      behavior: { actions: ['support'], intent: ['care'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: { affection: { base: 2 }, trust: { base: 1 } },
      conditions: {},
      generation: {
        must_fit_character: true,
        must_fit_context: true,
        variation: 'medium' as const,
      },
    };
    const provider = TestProvider.fromText(reactionJson);
    await generateReaction(context, state, option, provider);
    const prompt = provider.calls[0]?.messages[1]?.content ?? '';
    expect(prompt).toContain('【角色定位】你现在扮演「Mio」');
    expect(prompt).toContain('[检索记忆1]');
    expect(prompt).toContain('玩家上周说过会再来');
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

describe('#16 观察a：反应场景 grounding', () => {
  const context = {
    ...makeNarrativeContext(),
    currentEvent: {
      eventId: 'event_cafeteria_lunch',
      title: '食堂的午餐',
      description: '她在食堂大快朵颐，食物堆成小山。',
    },
  } as unknown as import('@ag/schemas').ModelContext;
  const state = makeNarrativeGameState();
  const option = {
    behavior: { actions: ['chat'], intent: ['connect'], risk: 0.1 },
  } as unknown as import('@ag/schemas').Option;

  it('options.scene 注入 [当前场景] 行（含日/时/地点/最近拍 + 禁跳转指令）', async () => {
    let captured = '';
    const provider = new TestProvider((request) => {
      captured = request.messages[1]?.content ?? '';
      return { text: 'not-json' };
    });
    const result = await generateReaction(context, state, option, provider, {
      scene: {
        day: 1,
        time: '10:30',
        locationId: 'loc_corridor',
        lastBeatSummary: '她把折角的书页抚平，抬头看我。',
      },
    });
    expect(captured).toContain('[当前场景] Day 1 10:30 @ loc_corridor');
    expect(captured).toContain('最近一拍：她把折角的书页抚平，抬头看我。');
    expect(captured).toContain('不得跳转到其他地点或时间');
    expect(captured).toContain('以本行为准');
    // scene 提供时：当前事件只保留标题，描述被抑制（防地点/时间锚定拉扯）
    expect(captured).toContain('进行中，地点/时间以 [当前场景] 为准');
    expect(captured).not.toMatch(/\[当前事件\][^\n]*：/);
    expect(result.source).toBe('fallback');
  });

  it('无 scene 时不注入 [当前场景] 行（向后兼容）', async () => {
    let captured = '';
    const provider = new TestProvider((request) => {
      captured = request.messages[1]?.content ?? '';
      return { text: 'not-json' };
    });
    await generateReaction(context, state, option, provider);
    expect(captured).not.toContain('[当前场景]');
  });
});
