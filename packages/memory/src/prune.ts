import type { GameState } from '@ag/schemas';
import { cloneGameState } from '@ag/core';

export interface PruneOptions {
  maxRecords?: number;
  /** 长期记忆在保留排序中的加权。 */
  longTermWeight?: number;
}

/**
 * Phase 11 容量控制：records/forgottenIds 只增不减问题的修剪策略。
 * 按 strength + importance 排序保留 Top-K；长期记忆获得权重保护。
 */
export function pruneMemories(state: GameState, options: PruneOptions = {}): GameState {
  const maxRecords = options.maxRecords ?? 100;
  const longTermWeight = options.longTermWeight ?? 1.5;
  const next = cloneGameState(state);

  const ranked = Object.values(next.memories.records)
    .map((record) => ({
      record,
      score:
        record.strength +
        record.importance * (next.memories.longTermIds.includes(record.id) ? longTermWeight : 1),
    }))
    .sort((a, b) => b.score - a.score || b.record.strength - a.record.strength);

  const keep = new Set(ranked.slice(0, Math.max(1, maxRecords)).map((entry) => entry.record.id));
  for (const entry of ranked) {
    if (!keep.has(entry.record.id)) {
      delete next.memories.records[entry.record.id];
      next.memories.forgottenIds = next.memories.forgottenIds.filter(
        (id) => id !== entry.record.id,
      );
    }
  }
  next.memories.shortTermIds = next.memories.shortTermIds.filter(
    (id) => id in next.memories.records && !next.memories.forgottenIds.includes(id),
  );
  next.memories.longTermIds = next.memories.longTermIds.filter(
    (id) => id in next.memories.records && !next.memories.forgottenIds.includes(id),
  );
  return next;
}
