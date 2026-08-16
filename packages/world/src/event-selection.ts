import {
  eventDefinitionSchema,
  type EventCandidate,
  type EventDefinition,
  type EventInstance,
  type EventRarity,
  type GameState,
} from '@ag/schemas';
import { evaluateConditions, type ConditionSet, type RNG } from '@ag/core';

export const RARITY_WEIGHT_MULTIPLIER: Record<EventRarity, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 2.5,
  legendary: 4,
};

export interface EventSelectionOptions {
  /** 每个 Event 最近一次触发时的 turn（用于 turns 冷却追踪）。 */
  lastTriggeredTurns?: Record<string, number>;
}

export interface EventCandidateWithMultipliers extends EventCandidate {
  rarityMultiplier: number;
}

/** 事件是否满足条件 / 地点 / 人物 / 关系类型 / 冷却。 */
export function isEventEligible(
  state: GameState,
  definition: EventDefinition,
  options: EventSelectionOptions = {},
): boolean {
  const parsed = eventDefinitionSchema.parse(definition);

  if (!evaluateConditions(state, parsed.conditions as ConditionSet)) {
    return false;
  }

  if (
    parsed.allowedLocationIds &&
    parsed.allowedLocationIds.length > 0 &&
    !parsed.allowedLocationIds.includes(state.world.currentLocationId)
  ) {
    return false;
  }

  if (parsed.requiresCharacterIds && parsed.requiresCharacterIds.length > 0) {
    for (const characterId of parsed.requiresCharacterIds) {
      const character = state.characters[characterId];
      if (!character || character.status !== 'active') return false;
    }
  }

  if (parsed.requiresRelationshipType) {
    const hasType = Object.values(state.relationships).some(
      (relationship) => relationship.type === parsed.requiresRelationshipType,
    );
    if (!hasType) return false;
  }

  if (isOnCooldown(state, parsed, options.lastTriggeredTurns)) {
    return false;
  }

  return true;
}

export function isOnCooldown(
  state: GameState,
  definition: EventDefinition,
  lastTriggeredTurns: Record<string, number> = {},
): boolean {
  const { cooldown } = definition;
  if (cooldown.days <= 0 && cooldown.turns <= 0) return false;

  const worldEvents = [...state.world.publicEvents, ...state.world.activeEvents];
  const lastDay = worldEvents
    .filter((event) => event.eventId === definition.eventId)
    .map((event) => event.lastTriggeredDay)
    .filter((day): day is number => day !== undefined)
    .sort((a, b) => b - a)[0];

  if (cooldown.days > 0 && lastDay !== undefined && state.run.day - lastDay < cooldown.days) {
    return true;
  }

  if (cooldown.turns > 0) {
    const lastTurn = lastTriggeredTurns[definition.eventId];
    if (lastTurn !== undefined && state.run.turn - lastTurn < cooldown.turns) {
      return true;
    }
  }

  return false;
}

/**
 * 计算 EventScore = BaseWeight × ContextMod × CharacterMod × RelationshipMod
 *                  × RarityMultiplier × RandomFactor。
 * RarityMultiplier 为 Phase 4 对稀有度权重的预留实现。
 */
export function scoreEvent(
  state: GameState,
  definition: EventDefinition,
  randomFactor: number,
): EventCandidateWithMultipliers {
  const parsed = eventDefinitionSchema.parse(definition);

  let contextModifier = 1;
  if (parsed.allowedLocationIds?.includes(state.world.currentLocationId)) {
    contextModifier *= 1.1;
  }

  let characterModifier = 1;
  if (parsed.requiresCharacterIds && parsed.requiresCharacterIds.length > 0) {
    characterModifier =
      parsed.requiresCharacterIds.reduce((sum, id) => {
        const character = state.characters[id];
        return sum + (character ? character.activity.availability / 100 : 0);
      }, 0) / parsed.requiresCharacterIds.length;
  }

  let relationshipModifier = 1;
  if (parsed.requiresRelationshipType) {
    const matching = Object.values(state.relationships).filter(
      (relationship) => relationship.type === parsed.requiresRelationshipType,
    );
    relationshipModifier = matching.length > 0 ? 1 + matching.length * 0.1 : 1;
  }

  const rarityMultiplier = RARITY_WEIGHT_MULTIPLIER[parsed.rarity] ?? 1;
  const score =
    parsed.baseWeight *
    contextModifier *
    characterModifier *
    relationshipModifier *
    rarityMultiplier *
    randomFactor;

  return {
    eventId: parsed.eventId,
    eligible: true,
    baseWeight: parsed.baseWeight,
    contextModifier,
    characterModifier,
    relationshipModifier,
    randomFactor,
    score,
    rarityMultiplier,
  };
}

/** 对定义列表计分并过滤，返回按 score 降序排列的候选。 */
export function rankEvents(
  state: GameState,
  definitions: readonly EventDefinition[],
  rng: RNG,
  options: EventSelectionOptions = {},
): EventCandidateWithMultipliers[] {
  return definitions
    .filter((definition) => isEventEligible(state, definition, options))
    .map((definition) => {
      const randomFactor = 0.5 + rng.next() * 0.5;
      return scoreEvent(state, definition, randomFactor);
    })
    .sort((a, b) => b.score - a.score);
}

/** 按候选 score 加权随机选择并实例化；无候选时抛错。 */
export function selectEvent(
  state: GameState,
  definitions: readonly EventDefinition[],
  rng: RNG,
  options: EventSelectionOptions = {},
): EventInstance {
  const event = trySelectEvent(state, definitions, rng, options);
  if (!event) {
    throw new Error('No eligible events in EventPool');
  }
  return event;
}

export function trySelectEvent(
  state: GameState,
  definitions: readonly EventDefinition[],
  rng: RNG,
  options: EventSelectionOptions = {},
): EventInstance | undefined {
  const candidates = rankEvents(state, definitions, rng, options);
  const selectedCandidate = pickWeighted(candidates, rng);
  if (!selectedCandidate) return undefined;
  const definition = definitions.find((item) => item.eventId === selectedCandidate.eventId);
  if (!definition) return undefined;
  return toEventInstance(state, selectedCandidate, definition, rng);
}

function pickWeighted(
  candidates: readonly EventCandidateWithMultipliers[],
  rng: RNG,
): EventCandidateWithMultipliers | undefined {
  if (candidates.length === 0) return undefined;
  const total = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  if (total <= 0) {
    return candidates[Math.floor(rng.next() * candidates.length)];
  }
  let target = rng.next() * total;
  for (const candidate of candidates) {
    target -= candidate.score;
    if (target <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function toEventInstance(
  state: GameState,
  candidate: EventCandidateWithMultipliers,
  definition: EventDefinition,
  rng: RNG,
): EventInstance {
  const parsed = eventDefinitionSchema.parse(definition);
  const nonce = Math.floor(rng.next() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return {
    instanceId: `${candidate.eventId}/run_${state.run.runId}/day_${state.run.day}/turn_${state.run.turn}_${nonce}`,
    eventId: parsed.eventId,
    runId: state.run.runId,
    day: state.run.day,
    turn: state.run.turn,
    locationId: state.world.currentLocationId,
    title: parsed.title,
    description: parsed.description,
    status: 'active',
    createdAt: { day: state.run.day, time: state.run.time },
  };
}
