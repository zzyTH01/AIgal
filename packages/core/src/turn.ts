import {
  finalStateDeltaSchema,
  optionSchema,
  turnResultSchema,
  type FinalStateDelta,
  type GameState,
  type Option,
  type RelationshipState,
  type TurnResult,
} from '@ag/schemas';
import { applyDelta, clamp, cloneGameState, validateGameState } from './game-state.js';

export function formatTurnId(runId: string, day: number, turn: number): string {
  return `${runId}/day_${day.toString().padStart(3, '0')}/turn_${turn.toString().padStart(3, '0')}`;
}

export function findPrimaryRelationshipId(state: GameState): string | undefined {
  const relationships = Object.values(state.relationships);
  return (
    relationships.find((relationship) => relationship.sourceId === 'player')?.relationshipId ??
    relationships.find((relationship) => relationship.targetId === 'player')?.relationshipId ??
    relationships[0]?.relationshipId
  );
}

export interface ResolveChoiceOptions {
  targetRelationshipId?: string;
  nextDayStartTime?: string;
}

export interface ChoiceResolution {
  state: GameState;
  turnId: string;
  directDelta: FinalStateDelta;
  crossedDayBoundary: boolean;
  targetRelationshipId?: string;
}

/**
 * Phase 2 的确定性 Stub Resolver。
 * 它只做三件事：把 Option.effects.base 直接作为最终 delta、Clamp 到 0~100、
 * 以及推进 turn 与 Daily Progress。真正的 Modifier 链在 Phase 3 替换本函数。
 */
export function resolveChoice(
  state: GameState,
  option: Option,
  options: ResolveChoiceOptions = {},
): ChoiceResolution {
  const parsedOption = optionSchema.parse(option);
  const before = cloneGameState(state);
  const targetRelationshipId = options.targetRelationshipId ?? findPrimaryRelationshipId(state);

  const nextTurn = before.run.turn + 1;
  const rawProgress = before.run.dailyProgress + parsedOption.gameplay.progress;
  const crossedDayBoundary = rawProgress >= before.run.dailyProgressLimit;
  const nextDay = crossedDayBoundary ? before.run.day + 1 : before.run.day;
  const nextProgress = crossedDayBoundary
    ? 0
    : clamp(rawProgress, 0, before.run.dailyProgressLimit);
  const nextTime = crossedDayBoundary ? (options.nextDayStartTime ?? '09:00') : before.run.time;

  const runDelta: FinalStateDelta['run'] = {
    turn: nextTurn,
    day: nextDay,
    dailyProgress: nextProgress,
    time: nextTime,
  };

  const relationships: FinalStateDelta['relationships'] = {};
  if (targetRelationshipId) {
    const relationship = before.relationships[targetRelationshipId];
    if (relationship) {
      const metricChanges: Record<string, { before: number; after: number; delta: number }> = {};
      for (const [metric, effect] of Object.entries(parsedOption.effects)) {
        if (!(metric in relationship)) continue;
        const beforeValue = (relationship as unknown as Record<string, unknown>)[metric];
        if (typeof beforeValue !== 'number') continue;
        const after = clamp(beforeValue + effect.base, 0, 100);
        metricChanges[metric] = {
          before: beforeValue,
          after,
          delta: after - beforeValue,
        };
      }
      if (Object.keys(metricChanges).length > 0) {
        relationships[targetRelationshipId] = metricChanges;
      }
    }
  }

  const directDelta: FinalStateDelta = finalStateDeltaSchema.parse({
    phase: 'final',
    run: runDelta,
    relationships,
  });

  const nextState = applyDelta(before, directDelta);
  const turnId = formatTurnId(nextState.run.runId, before.run.day, nextTurn);

  return {
    state: nextState,
    turnId,
    directDelta,
    crossedDayBoundary,
    targetRelationshipId,
  };
}

export class TurnTransaction {
  readonly turnId: string;
  readonly stateBefore: GameState;

  private currentState: GameState;
  private selectedOptionId?: string;
  private directDelta?: FinalStateDelta;
  private committed = false;

  private constructor(state: GameState) {
    const validation = validateGameState(state);
    if (!validation.success) {
      throw new Error(`Cannot start turn from invalid GameState: ${validation.issues.join('; ')}`);
    }
    this.stateBefore = cloneGameState(state);
    this.currentState = cloneGameState(state);
    this.turnId = formatTurnId(state.run.runId, state.run.day, state.run.turn + 1);
  }

  static start(state: GameState): TurnTransaction {
    return new TurnTransaction(state);
  }

  getState(): GameState {
    return cloneGameState(this.currentState);
  }

  get isCommitted(): boolean {
    return this.committed;
  }

  get isResolved(): boolean {
    return this.directDelta !== undefined;
  }

  resolveChoice(option: Option, options: ResolveChoiceOptions = {}): ChoiceResolution {
    if (this.committed) {
      throw new Error('Turn transaction already committed');
    }
    const resolution = resolveChoice(this.currentState, option, options);
    this.currentState = resolution.state;
    this.selectedOptionId = option.id;
    this.directDelta = resolution.directDelta;
    return resolution;
  }

  commitTurn(): TurnResult {
    if (!this.selectedOptionId || !this.directDelta) {
      throw new Error('Cannot commit a turn before resolveChoice');
    }
    const result: TurnResult = {
      schemaVersion: '0.1.0',
      turnId: this.turnId,
      runId: this.stateBefore.run.runId,
      stateBefore: cloneGameState(this.stateBefore),
      choice: { turnId: this.turnId, optionId: this.selectedOptionId },
      directDelta: cloneGameState(this.directDelta),
      reaction: { narrative: '', structured: {} },
      secondaryDelta: { phase: 'final' },
      newMemories: [],
      playerModel: cloneGameState(this.currentState.playerModel),
      worldUpdate: cloneGameState(this.currentState.world),
      finalState: cloneGameState(this.currentState),
    };
    this.committed = true;
    return turnResultSchema.parse(result);
  }

  /** 在 resolveChoice 之后、commit 之前执行确定性的后处理（如 Ending 判定）。 */
  settle(updater: (state: GameState) => GameState): GameState {
    if (this.committed) {
      throw new Error('Turn transaction already committed');
    }
    this.currentState = updater(this.currentState);
    return cloneGameState(this.currentState);
  }

  rollback(): GameState {
    this.committed = false;
    this.selectedOptionId = undefined;
    this.directDelta = undefined;
    this.currentState = cloneGameState(this.stateBefore);
    return cloneGameState(this.currentState);
  }
}

export function startTurn(state: GameState): TurnTransaction {
  return TurnTransaction.start(state);
}

export type { RelationshipState };
