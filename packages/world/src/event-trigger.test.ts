import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng-service.js';
import { EventPool } from './event-pool.js';
import { commitTriggeredEvent } from './event-trigger.js';
import { makeEventDefinition, makeWorldGameState } from './test-data.js';

describe('event trigger wiring (Phase 4 review)', () => {
  it('writes activeEvents.lastTriggeredDay and enforces day cooldown end-to-end', () => {
    const definition = makeEventDefinition({
      eventId: 'event_cooldown_e2e',
      cooldown: { days: 2, turns: 0 },
    });
    const state = makeWorldGameState();
    const pool = new EventPool([definition]);
    const rng = createSeededRng(42);

    const instance = pool.selectEvent(state, rng);
    const triggered = commitTriggeredEvent(state, definition, instance, pool);
    expect(triggered.world.activeEvents[0]?.eventId).toBe(definition.eventId);
    expect(triggered.world.activeEvents[0]?.lastTriggeredDay).toBe(1);

    const day2 = structuredClone(triggered);
    day2.run.day = 2;
    day2.world.day = 2;
    expect(pool.trySelectEvent(day2, rng)).toBeUndefined();

    const day3 = structuredClone(triggered);
    day3.run.day = 3;
    day3.world.day = 3;
    expect(pool.trySelectEvent(day3, rng)?.eventId).toBe(definition.eventId);
  });

  it('records turn cooldown through EventPool.recordTriggered', () => {
    const definition = makeEventDefinition({
      eventId: 'event_turn_e2e',
      cooldown: { days: 0, turns: 2 },
    });
    const state = makeWorldGameState();
    const pool = new EventPool([definition]);
    const instance = pool.selectEvent(state, createSeededRng(7));
    const triggered = commitTriggeredEvent(state, definition, instance, pool);

    const nextTurn = structuredClone(triggered);
    nextTurn.run.turn = instance.turn + 1;
    expect(pool.trySelectEvent(nextTurn, createSeededRng(7))).toBeUndefined();

    const afterCooldown = structuredClone(triggered);
    afterCooldown.run.turn = instance.turn + 2;
    expect(pool.trySelectEvent(afterCooldown, createSeededRng(7))?.eventId).toBe(
      definition.eventId,
    );
  });
});
