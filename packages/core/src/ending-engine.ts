import type { EndingDefinition, GameState, RunStatus } from '@ag/schemas';
import { cloneGameState } from './game-state.js';
import { evaluateConditions } from './rule-engine.js';

export interface EndingSelection {
  ending: EndingDefinition;
  triggered: boolean;
}

/**
 * Ending 判定：返回满足全部条件、priority 最高的 Ending。
 * Good/Normal → run.status = completed；Bad → run.status = bad_end。
 */
export function selectEnding(
  state: GameState,
  endings: readonly EndingDefinition[],
): EndingDefinition | undefined {
  return endings
    .filter((ending) => evaluateConditions(state, ending.conditions))
    .sort((a, b) => b.priority - a.priority)[0];
}

export function checkEnding(
  state: GameState,
  endings: readonly EndingDefinition[],
): EndingSelection | undefined {
  const ending = selectEnding(state, endings);
  return ending ? { ending, triggered: true } : undefined;
}

export function applyEnding(state: GameState, ending: EndingDefinition): GameState {
  const next = cloneGameState(state);
  next.run.status = ending.kind === 'bad' ? 'bad_end' : 'completed';
  if (!next.meta.endingsDiscovered.includes(ending.endingId)) {
    next.meta.endingsDiscovered.push(ending.endingId);
  }
  return next;
}

export function endingRunStatus(kind: EndingDefinition['kind']): RunStatus {
  return kind === 'bad' ? 'bad_end' : 'completed';
}
