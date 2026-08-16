import type { CognitionState, GameState, MemoryRecord } from '@ag/schemas';
import { cloneGameState } from '@ag/core';

/** S(t) = S0 · e^(−λt)；λ 受 forgetfulness/retention/grudge/obsession 影响。 */
export function decayLambda(cognition: CognitionState): number {
  const forgetfulness = cognition.forgetfulness / 100;
  const retention = Math.max(cognition.retention / 100, 0.05);
  return Math.max(0, 0.05 * (forgetfulness / retention));
}

export function decayedStrength(
  record: MemoryRecord,
  currentDay: number,
  cognition: CognitionState,
): number {
  const elapsedDays = Math.max(0, currentDay - record.createdAt.day);
  let lambda = decayLambda(cognition);
  // 负面事件：grudge 越高衰减越慢；obsession 对所有记忆都有保持作用。
  if (record.valence < 0) {
    lambda *= 1 - cognition.grudge / 200;
  }
  lambda *= 1 - cognition.obsession / 400;
  return Math.min(100, Math.max(0, record.strength * Math.exp(-lambda * elapsedDays)));
}

export function decayMemoryRecord(
  record: MemoryRecord,
  currentDay: number,
  cognition: CognitionState,
): MemoryRecord {
  return { ...record, strength: decayedStrength(record, currentDay, cognition) };
}

/** 对 MemoryState 中全部未遗忘记忆应用衰减，返回新 GameState。 */
export function decayAllMemories(
  state: GameState,
  currentDay: number,
  cognition: CognitionState,
): GameState {
  const next = cloneGameState(state);
  for (const id of Object.keys(next.memories.records)) {
    if (next.memories.forgottenIds.includes(id)) continue;
    const record = next.memories.records[id]!;
    next.memories.records[id] = decayMemoryRecord(record, currentDay, cognition);
  }
  return next;
}
