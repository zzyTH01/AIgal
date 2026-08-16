import { describe, expect, it } from 'vitest';
import { validateGameState } from '@ag/core';
import { TestProvider } from '@ag/llm';
import { JsonDirectorySaveRepository } from '@ag/persistence';
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
    expect(started.data!.world.activeEvents[0]?.eventId).toBe('event_quiet_library');

    const turn = await api.turnStart();
    expect(turn.ok).toBe(true);
    expect(turn.data!.options).toHaveLength(4);
    expect(turn.data!.scenario.narrative.length).toBeGreaterThan(0);

    const choice = await api.turnChoice(turn.data!.options[0]!.id);
    expect(choice.ok).toBe(true);
    expect(choice.data!.state.run.turn).toBe(1);
    expect(validateGameState(choice.data!.state).success).toBe(true);
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
});
