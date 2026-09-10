import type { GameTimestamp, GameState, PendingIntent } from '@ag/schemas';
import { cloneGameState } from './game-state.js';
import { evaluateConditions, type ConditionSet } from './rule-engine.js';

/**
 * Pending Intent Engine（Master Design §11 / Event Life Plan P1）：
 * 意图是角色"现在还想做什么"——与 Memory（过去）分离的唯一权威写入路径。
 * 生命周期：formPendingIntent(waiting) → markIntentTriggered(triggered)
 *          → completeIntent(completed) / cancelIntent(cancelled) / expireStaleIntents(expired)。
 */
export interface IntentCandidate {
  characterId: string;
  summary: string;
  sourceEventId?: string;
  sourceTurnId?: string;
  sourceMotive?: string;
  priority: number;
  conditions: ConditionSet;
  preferredLocations: string[];
  preferredTimeRange?: { from: string; to: string };
  latestTriggerDay: number;
}

export interface IntentTriggerContext {
  day: number;
  time: string;
  locationId: string;
  state: GameState;
}

function now(state: GameState): GameTimestamp {
  return { day: state.run.day, time: state.run.time };
}

/**
 * 产生意图：写入 pendingIntents（waiting）。
 * 去重规则：同角色同 summary 的 waiting 意图已存在时不重复产生。
 */
export function formPendingIntent(state: GameState, candidate: IntentCandidate): GameState {
  const next = cloneGameState(state);
  const store = (next.pendingIntents ??= { intents: {} });
  const duplicate = Object.values(store.intents).some(
    (intent) =>
      intent.status === 'waiting' &&
      intent.characterId === candidate.characterId &&
      intent.summary === candidate.summary,
  );
  if (duplicate) return state;

  const seq = Object.keys(store.intents).length + 1;
  const intent: PendingIntent = {
    id: `intent_${String(seq).padStart(3, '0')}`,
    characterId: candidate.characterId,
    summary: candidate.summary,
    sourceEventId: candidate.sourceEventId,
    sourceTurnId: candidate.sourceTurnId,
    sourceMotive: candidate.sourceMotive,
    priority: Math.max(0, Math.min(100, candidate.priority)),
    conditions: candidate.conditions,
    preferredLocations: [...candidate.preferredLocations],
    preferredTimeRange: candidate.preferredTimeRange
      ? { ...candidate.preferredTimeRange }
      : undefined,
    latestTriggerDay: candidate.latestTriggerDay,
    createdAt: now(next),
    status: 'waiting',
  };
  store.intents[intent.id] = intent;
  return next;
}

/** 触发匹配：状态条件 + 地点偏好 + 时间段偏好 + 未过期 + 状态为 waiting。 */
export function matchIntentContext(
  intent: PendingIntent,
  context: Omit<IntentTriggerContext, 'state'> & { state: GameState },
): boolean {
  if (intent.status !== 'waiting') return false;
  if (context.day > intent.latestTriggerDay) return false;
  if (
    intent.preferredLocations.length > 0 &&
    !intent.preferredLocations.includes(context.locationId)
  ) {
    return false;
  }
  if (intent.preferredTimeRange) {
    const { from, to } = intent.preferredTimeRange;
    if (context.time < from || context.time > to) return false;
  }
  if (!evaluateConditions(context.state, intent.conditions as ConditionSet)) return false;
  return true;
}

/** 择机触发判定入口：返回优先级最高的匹配意图（P5 调度器将在此加权）。 */
export function pickTopIntent(
  state: GameState,
  context: { day: number; time: string; locationId: string },
): PendingIntent | undefined {
  const intents = Object.values(state.pendingIntents?.intents ?? {});
  const matched = intents.filter((intent) => matchIntentContext(intent, { ...context, state }));
  if (matched.length === 0) return undefined;
  return matched.reduce((top, intent) => (intent.priority > top.priority ? intent : top));
}

export function markIntentTriggered(
  state: GameState,
  intentId: string,
  triggeredEventId: string,
): GameState {
  const next = cloneGameState(state);
  const intent = next.pendingIntents?.intents[intentId];
  if (!intent) throw new Error(`PendingIntent not found: ${intentId}`);
  intent.status = 'triggered';
  intent.triggeredEventId = triggeredEventId;
  return next;
}

export function completeIntent(state: GameState, intentId: string): GameState {
  const next = cloneGameState(state);
  const intent = next.pendingIntents?.intents[intentId];
  if (!intent) return state;
  intent.status = 'completed';
  intent.resolvedAt = now(next);
  return next;
}

export function cancelIntent(state: GameState, intentId: string): GameState {
  const next = cloneGameState(state);
  const intent = next.pendingIntents?.intents[intentId];
  if (!intent) return state;
  intent.status = 'cancelled';
  intent.resolvedAt = now(next);
  return next;
}

/** 过期清理：waiting 且超过 latestTriggerDay → expired（每次事件开启时调用）。 */
export function expireStaleIntents(state: GameState): GameState {
  const store = state.pendingIntents;
  if (!store) return state;
  const stale = Object.values(store.intents).filter(
    (intent) => intent.status === 'waiting' && state.run.day > intent.latestTriggerDay,
  );
  if (stale.length === 0) return state;
  const next = cloneGameState(state);
  for (const intent of stale) {
    const record = next.pendingIntents?.intents[intent.id];
    if (record) {
      record.status = 'expired';
      record.resolvedAt = now(next);
    }
  }
  return next;
}
