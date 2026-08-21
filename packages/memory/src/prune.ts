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
 * 遗忘记录在保留排序中降级（不与活跃记忆竞争名额），但总量仍受 maxRecords 约束
 * 以防档案无限膨胀（live-verify #14 口径修正）。
 * 注意：这是“硬删除修剪”，超容量记录不会进入 forgottenIds。
 */
export function pruneMemories(state: GameState, options: PruneOptions = {}): GameState {
  const maxRecords = options.maxRecords ?? 100;
  const longTermWeight = options.longTermWeight ?? 1.5;
  const next = cloneGameState(state);
  const forgotten = new Set(next.memories.forgottenIds);

  const ranked = Object.values(next.memories.records)
    .map((record) => ({
      record,
      forgotten: forgotten.has(record.id),
      score:
        record.strength +
        record.importance * (next.memories.longTermIds.includes(record.id) ? longTermWeight : 1),
    }))
    .sort(
      (a, b) =>
        Number(a.forgotten) - Number(b.forgotten) ||
        b.score - a.score ||
        b.record.strength - a.record.strength,
    );

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
