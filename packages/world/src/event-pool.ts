import {
  eventDefinitionSchema,
  type EventDefinition,
  type EventInstance,
  type GameState,
} from '@ag/schemas';
import type { RNG } from '@ag/core';
import { selectEvent, trySelectEvent } from './event-selection.js';

/**
 * EventPool 持有已注册 EventDefinition 与 turns 冷却追踪状态。
 * 天数冷却读取 GameState.world.publicEvents.lastTriggeredDay；回合冷却由本池记录。
 */
export class EventPool {
  private readonly definitions = new Map<string, EventDefinition>();
  private readonly lastTriggeredTurns = new Map<string, number>();

  constructor(definitions: readonly EventDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: EventDefinition): void {
    this.definitions.set(definition.eventId, eventDefinitionSchema.parse(definition));
  }

  remove(eventId: string): void {
    this.definitions.delete(eventId);
    this.lastTriggeredTurns.delete(eventId);
  }

  get(eventId: string): EventDefinition | undefined {
    return this.definitions.get(eventId);
  }

  list(): EventDefinition[] {
    return [...this.definitions.values()];
  }

  recordTriggered(eventId: string, _day: number, turn: number): void {
    if (!this.definitions.has(eventId)) {
      throw new Error(`Unknown eventId in EventPool: ${eventId}`);
    }
    this.lastTriggeredTurns.set(eventId, turn);
    // 天数冷却由 GameState.world.publicEvents.lastTriggeredDay 承载；
    // 调用方应在写入 WorldEventState 时同步 lastTriggeredDay = day。
  }

  selectEvent(state: GameState, rng: RNG): EventInstance {
    return selectEvent(state, this.list(), rng, {
      lastTriggeredTurns: Object.fromEntries(this.lastTriggeredTurns),
    });
  }

  trySelectEvent(state: GameState, rng: RNG): EventInstance | undefined {
    return trySelectEvent(state, this.list(), rng, {
      lastTriggeredTurns: Object.fromEntries(this.lastTriggeredTurns),
    });
  }

  resetCooldowns(): void {
    this.lastTriggeredTurns.clear();
  }
}
