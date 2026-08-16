import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng-service.js';
import { EventPool } from './event-pool.js';
import { makeEventDefinition, makeWorldGameState } from './test-data.js';

describe('EventPool', () => {
  it('registers definitions and tracks turn cooldown', () => {
    const state = makeWorldGameState();
    const event = makeEventDefinition({
      eventId: 'event_pooled',
      cooldown: { days: 0, turns: 2 },
    });
    const pool = new EventPool([event]);

    expect(pool.list()).toHaveLength(1);
    const first = pool.selectEvent(state, createSeededRng(1));
    expect(first.eventId).toBe('event_pooled');

    state.run.turn = first.turn;
    pool.recordTriggered(event.eventId, state.run.day, state.run.turn);
    state.run.turn += 1;
    expect(pool.trySelectEvent(state, createSeededRng(1))).toBeUndefined();

    state.run.turn += 2;
    expect(pool.trySelectEvent(state, createSeededRng(1))?.eventId).toBe('event_pooled');
  });

  it('removes definitions and resets cooldowns', () => {
    const event = makeEventDefinition({ eventId: 'event_removed' });
    const pool = new EventPool([event]);
    pool.recordTriggered(event.eventId, 1, 1);
    pool.remove(event.eventId);
    expect(pool.get(event.eventId)).toBeUndefined();
    expect(pool.list()).toHaveLength(0);
    expect(() => pool.recordTriggered(event.eventId, 1, 1)).toThrow();
  });
});
