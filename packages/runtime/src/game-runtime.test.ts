import { describe, expect, it } from 'vitest';
import { validateGameState } from '@ag/core';
import { TestProvider } from '@ag/llm';
import { JsonDirectorySaveRepository } from '@ag/persistence/json-directory';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplicationApi } from './application-api.js';
import { GameRuntime } from './game-runtime.js';

describe('GameRuntime', () => {
  it('starts a game and completes one full turn through the Application API', async () => {
    const api = ApplicationApi.create();
    const started = await api.gameStart();
    expect(started.ok).toBe(true);
    expect(validateGameState(started.data!).success).toBe(true);
    expect(started.data!.world.activeEvents[0]?.eventId).toBe('event_classroom_after_school');

    const turn = await api.turnStart();
    expect(turn.ok).toBe(true);
    expect(turn.data!.options).toHaveLength(4);
    expect(turn.data!.scenario.narrative.length).toBeGreaterThan(0);

    const choice = await api.turnChoice(turn.data!.options[0]!.id);
    expect(choice.ok).toBe(true);
    expect(choice.data!.state.run.turn).toBe(1);
    expect(validateGameState(choice.data!.state).success).toBe(true);
    expect(choice.data!.turnResult.secondaryDelta.characters?.char_asuka?.psychology).toBeDefined();
    expect(choice.data!.state.playerModel.caring).toBeGreaterThan(50);
    expect(Object.keys(choice.data!.state.memories.records).length).toBeGreaterThan(0);
  });

  it('falls back to deterministic content when LLM output is invalid', async () => {
    const runtime = new GameRuntime({ gateway: TestProvider.fromText('bad-json') });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.source).toBe('fallback');
    expect(turn.options).toHaveLength(4);
  });

  it('save/load restores GameState', async () => {
    const runtime = new GameRuntime();
    const started = runtime.startGame();
    await runtime.save('save_1');
    const saved = runtime.getState();
    await runtime.load('save_1');
    expect(runtime.getState()).toEqual(saved);
    expect(runtime.getState().run.runId).toBe(started.run.runId);
  });

  it('closes a bad run and starts a new run with inherited meta', () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    const badEnding = {
      endingId: 'ending_bad_test',
      kind: 'bad' as const,
      title: 'Bad End',
      description: '测试坏结局',
      conditions: { 'run.turn': { min: 1 } },
      priority: 50,
    };
    const ended = runtime.endRun(badEnding);
    expect(ended.meta.endingsDiscovered).toContain('ending_bad_test');
    expect(ended.run.status).toBe('bad_end');

    runtime.setPermanentModifier('starting_trust', 6);
    const next = runtime.startNewRun(123);
    expect(next.meta.endingsDiscovered).toContain('ending_bad_test');
    expect(next.meta.runCount).toBe(ended.meta.runCount + 1);
    expect(next.relationships.rel_player_char_asuka?.trust).toBe(6);
  });

  it('injects Project Policy into generation prompts', async () => {
    const requests: string[] = [];
    const provider = new TestProvider((request) => {
      requests.push(request.messages[0]?.content ?? '');
      return {
        text: request.messages[0]?.content.includes('行为选项')
          ? JSON.stringify({
              scenario: { narrative: '测试场景', structured: {} },
              options: [
                {
                  id: 'o1',
                  presentation: { text: '选项一', tone: 'neutral' },
                  behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
                  gameplay: { progress: 1 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o2',
                  presentation: { text: '选项二', tone: 'neutral' },
                  behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
                  gameplay: { progress: 0 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o3',
                  presentation: { text: '选项三', tone: 'neutral' },
                  behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o4',
                  presentation: { text: '选项四', tone: 'neutral' },
                  behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
              ],
            })
          : JSON.stringify({ narrative: '回应', structured: {} }),
      };
    });
    const runtime = new GameRuntime({
      gateway: provider,
      policy: {
        ageRating: 'all_ages',
        relationshipTypes: ['stranger'],
        contentTags: ['slice_of_life'],
        narrativeTone: 'gentle',
        matureThemes: [],
        generationConstraints: { avoid: 'violence' },
      },
    });
    runtime.startGame();
    await runtime.startTurn();
    expect(requests[0]).toContain('语气：gentle');
    expect(requests[0]).toContain('avoid: violence');
  });

  it('can persist to a JSON directory repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tavern-runtime-saves-'));
    const repo = new JsonDirectorySaveRepository({ baseDir: dir });
    const runtime = new GameRuntime({ persistence: repo });
    runtime.startGame();
    await runtime.save('run_017');
    expect(await repo.list()).toEqual(['run_017']);

    const restored = new GameRuntime({ persistence: repo });
    await restored.load('run_017');
    expect(restored.getState().run.runId).toBe('run_001');
    await rm(dir, { recursive: true, force: true });
  });

  it('reinforces retrieved memories on context assembly', async () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    const turn = await runtime.startTurn();
    await runtime.chooseOption(turn.options[0]!.id);
    const before = Object.values(runtime.getState().memories.records);
    expect(before.length).toBeGreaterThan(0);

    await runtime.startTurn();
    const after = runtime.getState().memories.records;
    for (const record of before) {
      const updated = after[record.id];
      expect(updated).toBeDefined();
      expect(updated!.retrievalCount).toBe(record.retrievalCount + 1);
      expect(updated!.strength).toBeGreaterThanOrEqual(record.strength);
      expect(updated!.lastRetrievedAt?.day).toBe(runtime.getState().run.day);
    }
  });

  it('exposes context cache stats that improve across turns', async () => {
    const runtime = new GameRuntime();
    runtime.startGame();
    await runtime.startTurn();
    const first = runtime.getContextCacheStats();
    expect(first.misses).toBeGreaterThan(0);

    await runtime.chooseOption((await runtime.getCurrentOptions())[0]?.id ?? '');
    await runtime.startTurn();
    const second = runtime.getContextCacheStats();
    expect(second.hits).toBeGreaterThan(first.hits);
  });

  it('prunes memories beyond the configured limit', async () => {
    const runtime = new GameRuntime({ memoryPruneLimit: 2 });
    runtime.startGame();
    for (let i = 0; i < 3; i += 1) {
      const turn = await runtime.startTurn();
      await runtime.chooseOption(turn.options[0]!.id);
    }
    expect(Object.keys(runtime.getState().memories.records).length).toBeLessThanOrEqual(2);
  });

  it('applies consistency rules to scenario and reaction generation', async () => {
    const provider = new TestProvider((request) =>
      request.messages.some((message) => message.content.includes('行为选项'))
        ? {
            text: JSON.stringify({
              scenario: { narrative: '场景中出现禁忌词', structured: {} },
              options: [
                {
                  id: 'o1',
                  presentation: { text: '选项一', tone: 'neutral' },
                  behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
                  gameplay: { progress: 1 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o2',
                  presentation: { text: '选项二', tone: 'neutral' },
                  behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
                  gameplay: { progress: 0 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o3',
                  presentation: { text: '选项三', tone: 'neutral' },
                  behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
                {
                  id: 'o4',
                  presentation: { text: '选项四', tone: 'neutral' },
                  behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
                  gameplay: { progress: 2 },
                  effects: {},
                  conditions: {},
                  generation: {
                    must_fit_character: true,
                    must_fit_context: true,
                    variation: 'medium',
                  },
                },
              ],
            }),
          }
        : { text: JSON.stringify({ narrative: '回应包含禁忌词', structured: {} }) },
    );
    const runtime = new GameRuntime({
      gateway: provider,
      consistency: { forbiddenTopics: ['禁忌词'] },
    });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.source).toBe('fallback');

    const choice = await runtime.chooseOption(turn.options[0]!.id);
    expect(choice.reactionText).toBe('……（NPC 没有回应。）');
  });

  it('retries flaky LLM calls according to llmMaxAttempts', async () => {
    let calls = 0;
    const combinedPayload = JSON.stringify({
      scenario: { narrative: '重试后的场景', structured: {} },
      options: [
        {
          id: 'o1',
          presentation: { text: '选项一', tone: 'neutral' },
          behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
          gameplay: { progress: 1 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o2',
          presentation: { text: '选项二', tone: 'neutral' },
          behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.1 },
          gameplay: { progress: 0 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o3',
          presentation: { text: '选项三', tone: 'neutral' },
          behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.1 },
          gameplay: { progress: 2 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
        {
          id: 'o4',
          presentation: { text: '选项四', tone: 'neutral' },
          behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.1 },
          gameplay: { progress: 2 },
          effects: {},
          conditions: {},
          generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
        },
      ],
    });
    const provider = new TestProvider(() => {
      calls += 1;
      if (calls === 1) throw new Error('flaky');
      return { text: combinedPayload };
    });
    const runtime = new GameRuntime({ gateway: provider, llmMaxAttempts: 2 });
    runtime.startGame();
    const turn = await runtime.startTurn();
    expect(turn.scenario.narrative).toBe('重试后的场景');
    expect(calls).toBe(2);
  });
});
