import {
  memoryCandidateSchema,
  memoryRecordSchema,
  type CognitionState,
  type GameState,
  type MemoryCandidate,
  type MemoryRecord,
} from '@ag/schemas';
import { cloneGameState } from '@ag/core';

export interface FormationOptions {
  /** CandidateScore 低于该阈值时不写入 MemoryState（只作为 Recent Events 由上层处理）。 */
  threshold?: number;
}

/**
 * CandidateScore = Importance × EmotionalIntensity × Novelty × CharacterMemoryFactor。
 * 所有因子与阈值均为可调规则；AI 只提供 candidate。
 */
export function calculateCandidateScore(
  candidate: MemoryCandidate,
  cognition: CognitionState,
  existingRecords: readonly MemoryRecord[],
): number {
  const parsed = memoryCandidateSchema.parse(candidate);
  const tags = new Set(parsed.tags);
  let maxTagOverlap = 0;
  for (const record of existingRecords) {
    const overlap = record.tags.filter((tag) => tags.has(tag)).length;
    const union = new Set([...record.tags, ...parsed.tags]).size;
    if (union > 0) {
      maxTagOverlap = Math.max(maxTagOverlap, overlap / union);
    }
  }
  const novelty = 1 - maxTagOverlap;
  const characterMemoryFactor = 0.5 + cognition.encoding / 200;
  return parsed.importance * parsed.emotionalIntensity * novelty * characterMemoryFactor;
}

export interface FormationResult {
  state: GameState;
  score: number;
  accepted: boolean;
  record?: MemoryRecord;
}

/** Stage 12 Memory Formation：候选评分 → 达阈值才写入 MemoryState。 */
export function formMemory(
  state: GameState,
  candidate: MemoryCandidate,
  cognition: CognitionState,
  options: FormationOptions = {},
): FormationResult {
  const parsed = memoryCandidateSchema.parse(candidate);
  const next = cloneGameState(state);
  const existing = Object.values(next.memories.records).filter(
    (record) => !next.memories.forgottenIds.includes(record.id),
  );
  const score = calculateCandidateScore(parsed, cognition, existing);
  const threshold = options.threshold ?? 100;

  if (score < threshold) {
    return { state: next, score, accepted: false };
  }

  const existingForTurn = Object.keys(next.memories.records).filter((id) =>
    id.startsWith(`${parsed.sourceTurnId}_`),
  ).length;
  const id = `${parsed.sourceTurnId}_${parsed.type}_${existingForTurn + 1}`;
  const record = memoryRecordSchema.parse({
    id,
    type: parsed.type,
    content: parsed.content,
    createdAt: { day: next.run.day, time: next.run.time },
    importance: parsed.importance,
    emotionalIntensity: parsed.emotionalIntensity,
    valence: parsed.valence,
    // TODO(Phase 11)：初始 strength 与 threshold=100 为经验值，留待 100 Runs 仿真校准。
    strength: Math.max(1, parsed.importance * 0.5 + parsed.emotionalIntensity * 0.3),
    accuracy: 90,
    tags: parsed.tags,
    relatedCharacters: parsed.relatedCharacters,
    sourceTurnId: parsed.sourceTurnId,
    retrievalCount: 0,
  });

  next.memories.records[record.id] = record;
  if (!next.memories.shortTermIds.includes(record.id)) {
    next.memories.shortTermIds.push(record.id);
  }
  next.memories.forgottenIds = next.memories.forgottenIds.filter((id) => id !== record.id);

  return { state: next, score, accepted: true, record };
}
