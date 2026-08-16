import type { EndingDefinition, GameState, Option, TurnResult } from '@ag/schemas';
import { applyEnding, selectEnding } from './ending-engine.js';
import { cloneGameState, validateGameState } from './game-state.js';
import { startTurn } from './turn.js';

export interface SimulationOptions {
  /** 每次 Turn 作用于哪个关系；缺省取 player 关系。 */
  targetRelationshipId?: string;
  /** 跨日重置时间。 */
  nextDayStartTime?: string;
  /** 每个 Turn 结束后检查的 Ending；触发后立即停止模拟。 */
  endings?: readonly EndingDefinition[];
  /** 允许跳过 Ending 检查，只跑固定 N 回合。 */
  stopOnEnding?: boolean;
}

export interface SimulationResult {
  finalState: GameState;
  turns: TurnResult[];
  requestedTurns: number;
  completedTurns: number;
  ended: boolean;
  ending?: EndingDefinition;
}

/**
 * 纯函数内存模拟器：不接 LLM、不使用 RNG，按 options 循环选择 Option。
 * 每个 Turn 经过 startTurn → resolveChoice → Ending 判定 → commitTurn。
 */
export function simulateNTurns(
  initialState: GameState,
  options: readonly Option[],
  turns: number,
  simulationOptions: SimulationOptions = {},
): SimulationResult {
  if (options.length === 0) {
    throw new Error('simulateNTurns requires at least one Option');
  }
  if (!Number.isInteger(turns) || turns < 0) {
    throw new Error('turns must be a non-negative integer');
  }

  const validation = validateGameState(initialState);
  if (!validation.success) {
    throw new Error(
      `simulateNTurns requires valid initial GameState: ${validation.issues.join('; ')}`,
    );
  }

  let state = cloneGameState(initialState);
  const turnResults: TurnResult[] = [];
  let ended = false;
  let ending: EndingDefinition | undefined;
  const stopOnEnding = simulationOptions.stopOnEnding ?? true;

  for (let index = 0; index < turns && !ended; index += 1) {
    const option = options[index % options.length]!;
    const transaction = startTurn(state);
    transaction.resolveChoice(option, {
      targetRelationshipId: simulationOptions.targetRelationshipId,
      nextDayStartTime: simulationOptions.nextDayStartTime,
    });

    if (stopOnEnding && simulationOptions.endings && simulationOptions.endings.length > 0) {
      const selected = selectEnding(transaction.getState(), simulationOptions.endings);
      if (selected) {
        ending = selected;
        ended = true;
        transaction.settle((current) => applyEnding(current, selected));
      }
    }

    const turnResult = transaction.commitTurn();
    turnResults.push(turnResult);
    state = turnResult.finalState;
  }

  return {
    finalState: state,
    turns: turnResults,
    requestedTurns: turns,
    completedTurns: turnResults.length,
    ended,
    ending,
  };
}
