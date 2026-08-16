import { contextBudgetSchema, type ContextBudget } from '@ag/schemas';

/** Capacity=80 的示例分配：System 15 / Current 15 / Recent 20 / Memories 20 / Internal 10。 */
const RATIOS = [3, 3, 4, 4, 2] as const;
const TOTAL_RATIO = 16;

export function allocateContextBudget(capacity: number): ContextBudget {
  const ratios = [...RATIOS];
  const allocations = ratios.map((ratio) => Math.floor((capacity * ratio) / TOTAL_RATIO));
  let remaining = capacity - allocations.reduce((sum, value) => sum + value, 0);

  // 余数优先给 Memories，其次 Recent；保证总和永不超 capacity。
  for (const index of [3, 2, 1, 4, 0]) {
    if (remaining <= 0) break;
    allocations[index] = Math.min(capacity, allocations[index]! + 1);
    remaining -= 1;
  }

  return contextBudgetSchema.parse({
    capacity,
    systemRules: allocations[0]!,
    currentState: allocations[1]!,
    recentEvents: allocations[2]!,
    memories: allocations[3]!,
    internalState: allocations[4]!,
  });
}
