import { gameTimestampSchema, type GameState, type MemoryRecord } from '@ag/schemas';
import { cloneGameState } from '@ag/core';

export interface ReinforceOptions {
  /** 单次强化增量（0~100 尺度）。 */
  boost?: number;
  /** 冷却天数：距上次强化不足 N 天则跳过，防止同日反复召回导致强度饱和（live-verify #14）。 */
  cooldownDays?: number;
}

/**
 * 回忆强化：默认 +12 并带 1 天冷却。
 * 原默认 +26 无冷却，真实 LLM 复验显示记忆 3~4 次检索即饱和到 100（known-issues #14）。
 */
export const DEFAULT_REINFORCEMENT_BOOST = 12;
export const DEFAULT_REINFORCEMENT_COOLDOWN_DAYS = 1;

export function reinforceMemoryRecord(
  state: GameState,
  memoryId: string,
  currentDay: number,
  options: ReinforceOptions | number = DEFAULT_REINFORCEMENT_BOOST,
): GameState {
  const resolved: ReinforceOptions =
    typeof options === 'number' ? { boost: options } : { ...options };
  const boost = resolved.boost ?? DEFAULT_REINFORCEMENT_BOOST;
  const cooldownDays = resolved.cooldownDays ?? DEFAULT_REINFORCEMENT_COOLDOWN_DAYS;

  const next = cloneGameState(state);
  const record = next.memories.records[memoryId];
  if (!record) {
    throw new Error(`Unknown memoryId: ${memoryId}`);
  }
  if (record.lastRetrievedAt && currentDay - record.lastRetrievedAt.day < cooldownDays) {
    return next;
  }
  const reinforced: MemoryRecord = {
    ...record,
    strength: Math.min(100, Math.max(0, record.strength + boost)),
    retrievalCount: record.retrievalCount + 1,
    lastRetrievedAt: gameTimestampSchema.parse({ day: currentDay, time: next.run.time }),
  };
  next.memories.records[memoryId] = reinforced;
  return next;
}
