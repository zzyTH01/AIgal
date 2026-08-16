import {
  baseStateDeltaSchema,
  finalStateDeltaSchema,
  modifierStateDeltaSchema,
  optionSchema,
  type BaseStateDelta,
  type FinalStateDelta,
  type GameState,
  type ModifierStateDelta,
  type Option,
  type PlayerModel,
  type RelationshipState,
} from '@ag/schemas';
import { clamp } from './game-state.js';
import type { RNG } from './rng.js';

export const RELATIONSHIP_NUMERIC_METRICS = [
  'affection',
  'trust',
  'intimacy',
  'familiarity',
  'attraction',
  'conflict',
  'respect',
  'dependency',
] as const;

export type RelationshipNumericMetric = (typeof RELATIONSHIP_NUMERIC_METRICS)[number];

export interface ResolverOptions {
  targetRelationshipId?: string;
}

export interface MetricResolution {
  metric: string;
  base: number;
  personalityModifier: number;
  relationshipModifier: number;
  contextModifier: number;
  emotionModifier: number;
  repetitionModifier: number;
  riskModifier: number;
  nonlinearFactor: number;
  before: number;
  after: number;
  delta: number;
}

export type TurnDirectDelta = FinalStateDelta;

export interface ResolveChoiceResult {
  baseDelta: BaseStateDelta;
  modifierDelta: ModifierStateDelta;
  directDelta: FinalStateDelta;
  riskOutcome: 'success' | 'failure' | undefined;
  targetRelationshipId?: string;
  trace: MetricResolution[];
}

/**
 * State Resolver —— 唯一有权确认关系数值的确定性引擎。
 * `ΔX = round(Base × Personality × Relationship × Context × Emotion × Repetition × Risk × Nonlinear)`
 * 结果再由 Clamp 保证 0~100。AI/选项只提供 base 倾向。
 */
export function resolveChoice(
  state: GameState,
  selectedOption: Option,
  rng: RNG,
  options: ResolverOptions = {},
): ResolveChoiceResult {
  const option = optionSchema.parse(selectedOption);
  const targetRelationshipId = options.targetRelationshipId ?? findPlayerRelationshipId(state);
  const relationship = targetRelationshipId ? state.relationships[targetRelationshipId] : undefined;
  const character = relationship ? findTargetCharacter(state, relationship) : undefined;

  const riskOutcome = resolveRiskOutcome(option.behavior.risk, rng);
  const riskModifier = resolveRiskModifier(option.behavior.risk, riskOutcome);

  const trace: MetricResolution[] = [];
  const relationshipBase: Record<string, number> = {};
  const relationshipFinal: Record<string, { before: number; after: number; delta: number }> = {};
  const modifiers: Record<string, number> = {};

  if (relationship && targetRelationshipId) {
    for (const [metric, effect] of Object.entries(option.effects)) {
      if (!isRelationshipNumericMetric(metric)) continue;
      const before = relationship[metric];

      // AI 可靠性层：非法/越界 base 被忽略，改用行为规则 fallback。
      const base = sanitizeEffectBase(effect.base, option);
      const personalityModifier = calculatePersonalityModifier(character, option, metric);
      const relationshipModifier = calculateRelationshipModifier(relationship, metric);
      const contextModifier = calculateContextModifier(state, character);
      const emotionModifier = calculateEmotionModifier(character);
      const repetitionModifier = calculateRepetitionModifier(state.playerModel, option);
      const nonlinearFactor = calculateNonlinearFactor(before, base);

      const rawDelta =
        base *
        personalityModifier *
        relationshipModifier *
        contextModifier *
        emotionModifier *
        repetitionModifier *
        riskModifier *
        nonlinearFactor;
      const delta = Math.round(rawDelta);
      const after = clamp(before + delta, 0, 100);

      relationshipBase[metric] = base;
      relationshipFinal[metric] = {
        before,
        after,
        delta: after - before,
      };

      const prefix = `relationship:${targetRelationshipId}.${metric}`;
      modifiers[`${prefix}.personality`] = personalityModifier;
      modifiers[`${prefix}.relationship`] = relationshipModifier;
      modifiers[`${prefix}.context`] = contextModifier;
      modifiers[`${prefix}.emotion`] = emotionModifier;
      modifiers[`${prefix}.repetition`] = repetitionModifier;
      modifiers[`${prefix}.risk`] = riskModifier;
      modifiers[`${prefix}.nonlinear`] = nonlinearFactor;

      trace.push({
        metric,
        base,
        personalityModifier,
        relationshipModifier,
        contextModifier,
        emotionModifier,
        repetitionModifier,
        riskModifier,
        nonlinearFactor,
        before,
        after,
        delta: after - before,
      });
    }
  }

  const baseDelta = baseStateDeltaSchema.parse({
    phase: 'base',
    relationships:
      Object.keys(relationshipBase).length > 0
        ? { [targetRelationshipId!]: relationshipBase }
        : undefined,
  });

  const modifierDelta = modifierStateDeltaSchema.parse({
    phase: 'modifier',
    modifiers,
    riskOutcome,
  });

  const directDelta = finalStateDeltaSchema.parse({
    phase: 'final',
    relationships:
      Object.keys(relationshipFinal).length > 0
        ? { [targetRelationshipId!]: relationshipFinal }
        : undefined,
  });

  return {
    baseDelta,
    modifierDelta,
    directDelta,
    riskOutcome,
    targetRelationshipId,
    trace,
  };
}

function findPlayerRelationshipId(state: GameState): string | undefined {
  const relationships = Object.values(state.relationships);
  return (
    relationships.find((relationship) => relationship.sourceId === 'player')?.relationshipId ??
    relationships.find((relationship) => relationship.targetId === 'player')?.relationshipId ??
    relationships[0]?.relationshipId
  );
}

function findTargetCharacter(state: GameState, relationship: RelationshipState) {
  const targetId =
    relationship.sourceId === 'player' ? relationship.targetId : relationship.sourceId;
  return state.characters[targetId];
}

function isRelationshipNumericMetric(metric: string): metric is RelationshipNumericMetric {
  return (RELATIONSHIP_NUMERIC_METRICS as readonly string[]).includes(metric);
}

function resolveRiskOutcome(risk: number, rng: RNG): 'success' | 'failure' | undefined {
  if (risk <= 0) return undefined;
  return rng.next() < 1 - risk ? 'success' : 'failure';
}

function resolveRiskModifier(risk: number, outcome: 'success' | 'failure' | undefined): number {
  if (outcome === 'success') return 1 + risk * 0.6;
  if (outcome === 'failure') return -(0.4 + risk * 0.6);
  return 1;
}

/**
 * AI 数值可靠性层：|base| > 100、NaN、Infinity 均视为非法。
 * 非法值不进入公式，改用行为语义的规则 fallback。
 */
function sanitizeEffectBase(rawBase: number, option: Option): number {
  if (Number.isFinite(rawBase) && Math.abs(rawBase) <= 100) {
    return rawBase;
  }

  const actions = new Set(option.behavior.actions);
  const intents = new Set(option.behavior.intent);
  const positive = ['support', 'help', 'protect', 'comfort', 'care', 'encouragement', 'flirt'];
  const negative = ['conflict', 'aggressive', 'provoke', 'challenge', 'insult', 'harm'];

  if ([...actions, ...intents].some((value) => positive.includes(value))) return 2;
  if ([...actions, ...intents].some((value) => negative.includes(value))) return -3;
  return 0;
}

function calculatePersonalityModifier(
  character: ReturnType<typeof findTargetCharacter>,
  option: Option,
  metric: string,
): number {
  const personality = character?.personality;
  if (!personality) return 1;

  const actions = new Set(option.behavior.actions);
  const intents = new Set(option.behavior.intent);
  const isSupport =
    actions.has('support') ||
    actions.has('help') ||
    actions.has('protect') ||
    intents.has('care') ||
    intents.has('encouragement');
  const isChallenge =
    actions.has('challenge') ||
    actions.has('confront') ||
    actions.has('tease') ||
    actions.has('provoke');
  const isConflict = actions.has('conflict') || actions.has('aggressive') || intents.has('provoke');

  if (metric === 'affection' || metric === 'attraction') {
    if (isSupport) {
      if (personality.independence >= 75) return -0.5;
      return clamp(
        1 + (personality.empathy - 50) / 200 + (personality.sensitivity - 50) / 200,
        0.5,
        1.5,
      );
    }
    if (isChallenge) {
      return clamp(
        1 + (personality.confidence - 50) / 200 + (personality.openness - 50) / 200,
        0.5,
        1.5,
      );
    }
    if (isConflict) return -clamp(0.5 + personality.assertiveness / 200, 0.5, 1.5);
    return 1;
  }

  if (metric === 'trust' || metric === 'respect' || metric === 'familiarity') {
    if (isSupport) return clamp(1 + (personality.empathy - 50) / 300, 0.5, 1.5);
    if (isConflict) return clamp(0.5 - personality.assertiveness / 200, 0.1, 1);
    return 1;
  }

  if (metric === 'conflict') {
    if (isConflict) return clamp(1 + personality.assertiveness / 200, 1, 2);
    if (isSupport) return 0.5;
    return 1;
  }

  return 1;
}

function calculateRelationshipModifier(relationship: RelationshipState, metric: string): number {
  if (metric === 'affection' || metric === 'attraction') {
    return clamp(1 + relationship.familiarity / 200 + relationship.intimacy / 300, 0.5, 1.5);
  }
  if (metric === 'trust' || metric === 'respect') {
    return clamp(1 + relationship.familiarity / 250 + relationship.respect / 300, 0.5, 1.5);
  }
  if (metric === 'conflict') {
    return clamp(1 + relationship.conflict / 200, 0.5, 2);
  }
  if (metric === 'dependency') {
    return clamp(1 + relationship.dependency / 250, 0.5, 1.5);
  }
  return 1;
}

function calculateContextModifier(
  state: GameState,
  character: ReturnType<typeof findTargetCharacter>,
): number {
  let modifier = 1;
  if (character) {
    if (character.status !== 'active') modifier *= 0.5;
    modifier *= 0.5 + character.activity.availability / 200;
    if (character.activity.locationId !== state.world.currentLocationId) modifier *= 0.85;
  }
  return clamp(modifier, 0.25, 1.5);
}

function calculateEmotionModifier(character: ReturnType<typeof findTargetCharacter>): number {
  if (!character) return 1;
  const valenceFactor =
    1 + (character.emotion.valence / 100) * (character.emotion.intensity / 100) * 0.4;
  const energyFactor = 1 + (character.emotion.energy - 50) / 200;
  return clamp(valenceFactor * energyFactor, 0.5, 1.5);
}

function calculateRepetitionModifier(playerModel: PlayerModel, option: Option): number {
  const recent = option.behavior.actions.reduce(
    (sum, action) =>
      sum + playerModel.recentBehaviorPattern.filter((entry) => entry === action).length,
    0,
  );
  const historical = option.behavior.actions.reduce(
    (sum, action) => sum + (playerModel.behavioralPatterns[`player_${action}`] ?? 0),
    0,
  );
  const count = recent + historical;
  if (count <= 1) return 1;
  return Math.max(-1, 1 - (count - 1) * 0.2);
}

function calculateNonlinearFactor(current: number, base: number): number {
  const ratio = current / 100;
  if (base > 0) return Math.max(0, 1 - ratio * ratio);
  if (base < 0) return Math.max(0, ratio * ratio);
  return 1;
}

/**
 * 更新 PlayerModel 的重复行为记忆。该函数只描述“角色观察到了这次选择”，
 * 真正的 PlayerModel Update Engine 会在后续 Phase 细化判断与解释。
 */
export function observePlayerChoice(state: GameState, option: Option): GameState {
  const parsedOption = optionSchema.parse(option);
  const next: GameState = structuredClone(state);
  for (const action of parsedOption.behavior.actions) {
    next.playerModel.recentBehaviorPattern.push(action);
    next.playerModel.behavioralPatterns[`player_${action}`] =
      (next.playerModel.behavioralPatterns[`player_${action}`] ?? 0) + 1;
  }
  next.playerModel.recentBehaviorPattern = next.playerModel.recentBehaviorPattern.slice(-20);
  return next;
}
