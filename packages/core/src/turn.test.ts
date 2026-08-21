import { describe, expect, it } from 'vitest';
import { finalStateDeltaSchema } from '@ag/schemas';
import { cloneGameState } from './game-state.js';
import { makeCoreGameState, restOption, supportOption } from './test-data.js';
import { findPrimaryRelationshipId, formatTurnId, startTurn } from './turn.js';

describe('Turn transaction shell', () => {
  it('resolves a choice with final deltas and commits a valid TurnResult', () => {
    const state = makeCoreGameState();
    const transaction = startTurn(state);
    expect(transaction.turnId).toBe(formatTurnId('run_017', 1, 1));
    expect(findPrimaryRelationshipId(state)).toBe('rel_player_mio');

    const resolution = transaction.resolveChoice(supportOption);
    expect(resolution.state.run.turn).toBe(1);
    expect(resolution.state.run.dailyProgress).toBe(2);
    expect(resolution.state.relationships.rel_player_mio!.affection).toBe(
      resolution.directDelta.relationships?.rel_player_mio?.affection?.after,
    );
    expect(finalStateDeltaSchema.safeParse(resolution.directDelta).success).toBe(true);

    const result = transaction.commitTurn();
    expect(result.choice.optionId).toBe('option_support');
    expect(result.finalState.run.turn).toBe(1);
    expect(transaction.isCommitted).toBe(true);
  });

  it('captures memories formed during settle and the NPC reaction into TurnResult', () => {
    const state = makeCoreGameState();
    const transaction = startTurn(state);
    transaction.resolveChoice(supportOption);

    transaction.settle((current) => {
      const next = cloneGameState(current);
      next.memories.records['mem_test_new'] = {
        id: 'mem_test_new',
        type: 'episodic',
        content: '测试记忆',
        createdAt: { day: 1, time: '09:00' },
        importance: 40,
        emotionalIntensity: 25,
        valence: 10,
        strength: 30,
        accuracy: 90,
        tags: ['test'],
        relatedCharacters: ['char_mio'],
        sourceTurnId: 'run_017/day_001/turn_001',
        retrievalCount: 0,
      };
      next.memories.shortTermIds.push('mem_test_new');
      return next;
    });
    transaction.setReaction({ narrative: '测试反应文本', structured: {} });

    const result = transaction.commitTurn();
    expect(result.newMemories.map((record) => record.id)).toEqual(['mem_test_new']);
    expect(result.reaction.narrative).toBe('测试反应文本');
  });

  it('delegates day advancement so weekday stays in sync', () => {
    const state = makeCoreGameState();
    state.run.dailyProgress = 11;
    const transaction = startTurn(state);
    const resolution = transaction.resolveChoice(supportOption);

    expect(resolution.crossedDayBoundary).toBe(true);
    expect(resolution.state.run.day).toBe(2);
    expect(resolution.state.run.dailyProgress).toBe(0);
    expect(resolution.state.run.time).toBe('09:00');
    expect(resolution.state.world.day).toBe(2);
    expect(resolution.state.world.time).toBe('09:00');
    expect(resolution.state.world.weekday).toBe('tuesday');
  });

  it('rolls back to state before turn and allows re-resolution', () => {
    const state = makeCoreGameState();
    const transaction = startTurn(state);
    transaction.resolveChoice(supportOption);
    const rolledBack = transaction.rollback();
    expect(rolledBack.run.turn).toBe(0);
    expect(rolledBack.relationships.rel_player_mio!.affection).toBe(30);
    expect(transaction.getState().run.turn).toBe(0);

    const resolution = transaction.resolveChoice(restOption);
    expect(resolution.state.run.turn).toBe(1);
  });

  it('rejects an invalid initial state', () => {
    const state = makeCoreGameState();
    state.schemaVersion = '0.0.1' as never;
    expect(() => startTurn(state)).toThrow();
  });

  it('does not mutate the snapshot passed to startTurn', () => {
    const state = makeCoreGameState();
    const snapshot = cloneGameState(state);
    startTurn(state).resolveChoice(supportOption);
    expect(state).toEqual(snapshot);
  });
});
