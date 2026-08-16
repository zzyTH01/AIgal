import { gameTimestampSchema, type GameState, type MemoryRecord } from '@ag/schemas';
import { cloneGameState } from '@ag/core';

/**
 * 回忆强化：默认 +26（0~100 尺度），对应设计示例 0.42 → 0.68。
 */
export function reinforceMemoryRecord(
  state: GameState,
  memoryId: string,
  currentDay: number,
  boost = 26,
): GameState {
  const next = cloneGameState(state);
  const record = next.memories.records[memoryId];
  if (!record) {
    throw new Error(`Unknown memoryId: ${memoryId}`);
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
