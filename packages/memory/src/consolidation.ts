import type { CognitionState, GameState } from '@ag/schemas';
import { decayAllMemories } from './decay.js';

export interface ConsolidationOptions {
  /** 短期记忆进入长期的强度阈值。 */
  strengthThreshold?: number;
  /** 高重要性短期记忆即使强度不足也进入长期。 */
  importanceThreshold?: number;
  /** 长期记忆强度低于该阈值时遗忘。 */
  forgettingThreshold?: number;
}

/**
 * Stage 16 Memory Consolidation：Day 结束时短期 → 长期 / 遗忘；长期衰减后过低也遗忘。
 */
export function consolidateMemories(
  state: GameState,
  currentDay: number,
  cognition: CognitionState,
  options: ConsolidationOptions = {},
): GameState {
  const next = decayAllMemories(state, currentDay, cognition);
  const strengthThreshold = options.strengthThreshold ?? 50;
  const importanceThreshold = options.importanceThreshold ?? 60;
  const forgettingThreshold = options.forgettingThreshold ?? 10;

  for (const id of next.memories.shortTermIds) {
    const record = next.memories.records[id];
    if (!record) continue;
    if (record.strength >= strengthThreshold || record.importance >= importanceThreshold) {
      next.memories.longTermIds = uniquePush(next.memories.longTermIds, id);
    } else {
      next.memories.forgottenIds = uniquePush(next.memories.forgottenIds, id);
    }
  }
  next.memories.shortTermIds = next.memories.shortTermIds.filter(
    (id) => !next.memories.longTermIds.includes(id) && !next.memories.forgottenIds.includes(id),
  );

  for (const id of next.memories.longTermIds) {
    const record = next.memories.records[id];
    if (!record) continue;
    // 高重要性长期记忆即使强度低也保留（对应 design 的 importance 保护）。
    if (record.strength < forgettingThreshold && record.importance < importanceThreshold) {
      next.memories.forgottenIds = uniquePush(next.memories.forgottenIds, id);
    }
  }
  next.memories.longTermIds = next.memories.longTermIds.filter(
    (id) => !next.memories.forgottenIds.includes(id),
  );

  next.memories.lastConsolidatedDay = currentDay;
  return next;
}

function uniquePush(target: string[], value: string): string[] {
  return target.includes(value) ? target : [...target, value];
}
