import type { CognitionState, MemoryRecord } from '@ag/schemas';
import {
  DEFAULT_RETRIEVAL_WEIGHTS,
  retrievalScore,
  type RetrievalQuery,
  type RetrievalWeights,
} from '@ag/memory';

/** MemoryRanker：复用 Memory Engine 的检索评分进行排序。 */
export function rankMemories(
  records: readonly MemoryRecord[],
  query: RetrievalQuery,
  cognition: CognitionState,
  weights: RetrievalWeights = DEFAULT_RETRIEVAL_WEIGHTS,
): MemoryRecord[] {
  return [...records]
    .map((record) => ({ record, score: retrievalScore(record, query, cognition, weights) }))
    .sort((a, b) => b.score - a.score || b.record.strength - a.record.strength)
    .map((entry) => entry.record);
}

export const memoryRanker = Object.freeze({ rank: rankMemories });
