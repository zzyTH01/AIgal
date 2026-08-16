import { type EndingDefinition, type GameState, type KnowledgeRecord } from '@ag/schemas';
import { applyEnding } from './ending-engine.js';
import { createGameState, defaultRelationship } from './game-state.js';

export interface PunishmentOptions {
  permanentModifier?: string;
  modifierDelta?: number;
}

/**
 * Bad End → Punishment → Meta Progression：
 * 写入 Knowledge / Unlock / Ending Archive / Permanent Modifier。
 */
export function applyBadEndPunishment(
  state: GameState,
  ending: EndingDefinition,
  options: PunishmentOptions = {},
): GameState {
  const next = applyEnding(state, ending);
  const modifierKey = options.permanentModifier ?? `ending_${ending.endingId}`;
  const knowledge: KnowledgeRecord = {
    id: `knowledge_${ending.endingId}_${next.meta.runCount}`,
    title: `教训：${ending.title}`,
    content: `你在 Run ${next.run.runId} 触发了结局「${ending.title}」。这个信息会带入下一局。`,
    tags: ['ending_lesson', ending.kind],
    sourceRunId: next.run.runId,
    acquiredAt: { day: next.run.day, time: next.run.time },
  };
  next.meta.knowledge[knowledge.id] = knowledge;
  next.meta.endingsDiscovered = uniquePush(next.meta.endingsDiscovered, ending.endingId);
  next.meta.unlocks = uniquePush(next.meta.unlocks, `ending_${ending.endingId}`);
  next.meta.permanentModifiers[modifierKey] =
    (next.meta.permanentModifiers[modifierKey] ?? 0) + (options.modifierDelta ?? 1);
  next.meta.completedRuns += 1;
  return next;
}

export interface NewRunOptions {
  runId?: string;
  seed?: number;
  startingAffectionModifierKey?: string;
  startingTrustModifierKey?: string;
}

/** New Run：继承 MetaState，并让 Permanent Modifier 影响开局关系。 */
export function startNewRunFromMeta(
  previousMeta: GameState['meta'],
  options: NewRunOptions = {},
): GameState {
  const seed = options.seed ?? 1;
  const state = createGameState({
    runId: options.runId ?? `run_${previousMeta.runCount + 1}`,
    seed,
  });
  state.meta = structuredClone(previousMeta);
  state.meta.runCount += 1;

  const affectionModifier =
    state.meta.permanentModifiers[options.startingAffectionModifierKey ?? 'starting_affection'] ??
    0;
  const trustModifier =
    state.meta.permanentModifiers[options.startingTrustModifierKey ?? 'starting_trust'] ?? 0;

  const relationship = defaultRelationship('player', 'char_asuka', 'rel_player', {
    type: 'stranger',
    affection: Math.max(0, Math.min(100, affectionModifier)),
    trust: Math.max(0, Math.min(100, trustModifier)),
  });
  state.relationships[relationship.relationshipId] = relationship;
  return state;
}

export function applyMetaProgression(state: GameState, ending: EndingDefinition): GameState {
  const next = applyEnding(state, ending);
  next.meta.endingsDiscovered = uniquePush(next.meta.endingsDiscovered, ending.endingId);
  next.meta.completedRuns += 1;
  return next;
}

function uniquePush(target: string[], value: string): string[] {
  return target.includes(value) ? target : [...target, value];
}

export function inheritMetaState(previous: GameState, next: GameState): GameState {
  next.meta = structuredClone(previous.meta);
  next.meta.runCount += 1;
  return next;
}
