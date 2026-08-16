import type { CognitionState, GameState, MemoryRecord } from '@ag/schemas';
import { cloneGameState } from '@ag/core';
import { reinforceMemoryRecord } from './reinforcement.js';

export interface RetrievalQuery {
  tags?: string[];
  text?: string;
}

export interface RetrievalWeights {
  relevance: number;
  importance: number;
  emotion: number;
  strength: number;
  obsession: number;
}

export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalWeights = {
  relevance: 0.4,
  importance: 0.2,
  emotion: 0.2,
  strength: 0.1,
  obsession: 0.1,
};

/** Score = w_r·R + w_i·I + w_e·E + w_s·S + w_o·O。 */
export function retrievalScore(
  record: MemoryRecord,
  query: RetrievalQuery,
  cognition: CognitionState,
  weights: RetrievalWeights = DEFAULT_RETRIEVAL_WEIGHTS,
): number {
  const relevance = calculateRelevance(record, query);
  const importance = record.importance / 100;
  const emotion = record.emotionalIntensity / 100;
  const strength = record.strength / 100;
  const obsession = cognition.obsession / 100;
  return (
    weights.relevance * relevance +
    weights.importance * importance +
    weights.emotion * emotion +
    weights.strength * strength +
    weights.obsession * obsession
  );
}

function calculateRelevance(record: MemoryRecord, query: RetrievalQuery): number {
  const queryTags = new Set(query.tags ?? []);
  const recordTags = new Set(record.tags);
  let tagRelevance = 0;
  if (queryTags.size > 0) {
    const overlap = [...queryTags].filter((tag) => recordTags.has(tag)).length;
    tagRelevance = overlap / queryTags.size;
  }

  let textRelevance = 0;
  const queryText = query.text?.trim();
  if (queryText) {
    const queryTokens = tokenize(queryText);
    const recordTokens = tokenize(record.content);
    if (queryTokens.length > 0 && recordTokens.length > 0) {
      const overlap = queryTokens.filter((token) => recordTokens.includes(token)).length;
      textRelevance = overlap / Math.max(queryTokens.length, recordTokens.length);
    }
  }

  return Math.max(tagRelevance, textRelevance);
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const segments = normalized
    .split(/[，。！？、；：\s,.!?;:]+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const tokens: string[] = [];
  for (const segment of segments) {
    if (/^[\u4e00-\u9fff]+$/.test(segment)) {
      // 中文：整段拆成字符 bigram，避免“连续中文 = 单 token 二值匹配”。
      if (segment.length <= 2) {
        tokens.push(segment);
      } else {
        for (let index = 0; index < segment.length - 1; index += 1) {
          tokens.push(segment.slice(index, index + 2));
        }
      }
    } else {
      tokens.push(segment);
    }
  }
  return tokens;
}

export interface RetrievalOptions {
  topK?: number;
  weights?: RetrievalWeights;
  excludeForgotten?: boolean;
}

export function retrieveMemories(
  state: GameState,
  query: RetrievalQuery,
  cognition: CognitionState,
  options: RetrievalOptions = {},
): MemoryRecord[] {
  const excludeForgotten = options.excludeForgotten ?? true;
  const weights = options.weights ?? DEFAULT_RETRIEVAL_WEIGHTS;
  const topK = options.topK ?? 5;

  return Object.values(state.memories.records)
    .filter((record) => !excludeForgotten || !state.memories.forgottenIds.includes(record.id))
    .map((record) => ({ record, score: retrievalScore(record, query, cognition, weights) }))
    .sort((a, b) => b.score - a.score || b.record.strength - a.record.strength)
    .slice(0, Math.max(1, topK))
    .map((entry) => entry.record);
}

/**
 * 检索并强化（回忆本身会增强记忆）。返回新 GameState。
 */
export function retrieveAndReinforce(
  state: GameState,
  query: RetrievalQuery,
  cognition: CognitionState,
  options: RetrievalOptions & { reinforcementBoost?: number } = {},
): { state: GameState; records: MemoryRecord[] } {
  const records = retrieveMemories(state, query, cognition, options);
  let next = cloneGameState(state);
  for (const record of records) {
    next = reinforceMemoryRecord(next, record.id, next.run.day, options.reinforcementBoost);
  }
  return { state: next, records };
}
