import {
  gameStateSchema,
  modelContextSchema,
  type GameState,
  type ModelContext,
} from '@ag/schemas';

export interface StateInspection {
  schemaVersion: string;
  day: number;
  turn: number;
  time: string;
  locationId: string;
  characters: string[];
  relationships: Array<{ id: string; type: string; affection: number; trust: number }>;
  memoryRecords: number;
  memoryForgotten: number;
  flags: string[];
}

export function inspectState(state: GameState): StateInspection {
  const parsed = gameStateSchema.parse(state);
  return {
    schemaVersion: parsed.schemaVersion,
    day: parsed.run.day,
    turn: parsed.run.turn,
    time: parsed.run.time,
    locationId: parsed.world.currentLocationId,
    characters: Object.values(parsed.characters).map((character) => character.identity.name),
    relationships: Object.values(parsed.relationships).map((relationship) => ({
      id: relationship.relationshipId,
      type: relationship.type,
      affection: relationship.affection,
      trust: relationship.trust,
    })),
    memoryRecords: Object.keys(parsed.memories.records).length,
    memoryForgotten: parsed.memories.forgottenIds.length,
    flags: Object.keys(parsed.flags),
  };
}

export interface MemoryInspection {
  records: number;
  shortTerm: number;
  longTerm: number;
  forgotten: number;
  avgStrength: number;
  topMemories: Array<{ id: string; content: string; strength: number }>;
}

export function inspectMemory(state: GameState): MemoryInspection {
  const records = Object.values(state.memories.records);
  const top = [...records]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map((record) => ({ id: record.id, content: record.content, strength: record.strength }));
  return {
    records: records.length,
    shortTerm: state.memories.shortTermIds.length,
    longTerm: state.memories.longTermIds.length,
    forgotten: state.memories.forgottenIds.length,
    avgStrength:
      records.length === 0
        ? 0
        : records.reduce((sum, record) => sum + record.strength, 0) / records.length,
    topMemories: top,
  };
}

export interface ContextInspection {
  valid: boolean;
  budgetCapacity: number;
  budgetUsed: number;
  retrievedMemories: number;
  recentEvents: number;
  promptTask: string;
}

export function inspectContext(context: ModelContext): ContextInspection {
  const parsed = modelContextSchema.parse(context);
  const budgetUsed =
    parsed.budget.systemRules +
    parsed.budget.currentState +
    parsed.budget.recentEvents +
    parsed.budget.memories +
    parsed.budget.internalState;
  return {
    valid: true,
    budgetCapacity: parsed.budget.capacity,
    budgetUsed,
    retrievedMemories: parsed.retrievedMemories.length,
    recentEvents: parsed.recentEvents.length,
    promptTask: parsed.generationTask.task,
  };
}
