import {
  eventDefinitionSchema,
  eventInstanceSchema,
  type EventDefinition,
  type EventInstance,
  type GameState,
  type WorldEventState,
} from '@ag/schemas';
import { cloneGameState } from '@ag/core';
import type { EventPool } from './event-pool.js';

/**
 * Phase 4 review 必做接线点：
 * 事件选择成功后，Turn 编排必须把 EventInstance 写入 world.activeEvents
 * 并设置 lastTriggeredDay，同时调用 EventPool.recordTriggered 记录回合冷却。
 */
export function commitTriggeredEvent(
  state: GameState,
  definition: EventDefinition,
  instance: EventInstance,
  eventPool?: EventPool,
): GameState {
  const parsedDefinition = eventDefinitionSchema.parse(definition);
  const parsedInstance = eventInstanceSchema.parse(instance);

  if (parsedInstance.eventId !== parsedDefinition.eventId) {
    throw new Error('EventInstance.eventId must match EventDefinition.eventId');
  }

  const next = cloneGameState(state);
  const worldEvent: WorldEventState = {
    eventId: parsedDefinition.eventId,
    type: parsedDefinition.type,
    rarity: parsedDefinition.rarity,
    title: parsedDefinition.title,
    description: parsedDefinition.description,
    weight: parsedDefinition.baseWeight,
    lastTriggeredDay: parsedInstance.day,
  };

  next.world.activeEvents = [
    worldEvent,
    ...next.world.activeEvents.filter((event) => event.eventId !== parsedDefinition.eventId),
  ];

  if (eventPool) {
    eventPool.recordTriggered(parsedDefinition.eventId, parsedInstance.day, parsedInstance.turn);
  }

  return next;
}
