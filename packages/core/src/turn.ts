import {
  finalStateDeltaSchema,
  optionSchema,
  turnResultSchema,
  type BaseStateDelta,
  type FinalStateDelta,
  type GameState,
  type ModifierStateDelta,
  type Option,
  type RelationshipState,
  type TurnResult,
} from '@ag/schemas';
import { applyDelta, clamp, cloneGameState, validateGameState } from './game-state.js';
import { advanceDay, isDayComplete } from './progress-engine.js';
import { ALWAYS_SUCCESS_RNG, type RNG } from './rng.js';
import { observePlayerChoice, resolveChoice as resolveChoiceEffects } from './state-resolver.js';

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
  /** Phase 3 起用于 Risk 分支；缺省为永远成功。 */
  rng?: RNG;
}

export interface ChoiceResolution {
  state: GameState;
  turnId: string;
  directDelta: FinalStateDelta;
  crossedDayBoundary: boolean;
  targetRelationshipId?: string;
  baseDelta: BaseStateDelta;
  modifierDelta: ModifierStateDelta;
  riskOutcome: 'success' | 'failure' | undefined;
}

/**
 * Turn 内的一次完整确定性结算：
 * StateResolver 确认关系 delta → applyDelta → PlayerModel 观察 → 跨日推进。
 */
export function applyChoiceToState(
  state: GameState,
  option: Option,
  options: ResolveChoiceOptions = {},
): ChoiceResolution {
  const parsedOption = optionSchema.parse(option);
  const before = cloneGameState(state);
  const targetRelationshipId = options.targetRelationshipId ?? findPrimaryRelationshipId(state);
  const rng = options.rng ?? ALWAYS_SUCCESS_RNG;

  const nextTurn = before.run.turn + 1;
  const nextProgress = clamp(
    before.run.dailyProgress + parsedOption.gameplay.progress,
    0,
    before.run.dailyProgressLimit,
  );

  const resolved = resolveChoiceEffects(before, parsedOption, rng, { targetRelationshipId });
  const directDelta: FinalStateDelta = finalStateDeltaSchema.parse({
    phase: 'final',
    run: {
      turn: nextTurn,
      dailyProgress: nextProgress,
    },
    relationships: resolved.directDelta.relationships,
  });

  let nextState = applyDelta(before, directDelta);
  nextState = observePlayerChoice(nextState, parsedOption);
  const crossedDayBoundary = isDayComplete(nextState);
  if (crossedDayBoundary) {
    // 天数推进只有 advanceDay 一条权威路径；weekday/time/progress 一并由它推进。
    nextState = advanceDay(nextState, options.nextDayStartTime ?? '09:00');
  }

  const turnId = formatTurnId(nextState.run.runId, before.run.day, nextTurn);

  return {
    state: nextState,
    turnId,
    directDelta,
    crossedDayBoundary,
    targetRelationshipId,
    baseDelta: resolved.baseDelta,
    modifierDelta: resolved.modifierDelta,
    riskOutcome: resolved.riskOutcome,
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
    const resolution = applyChoiceToState(this.currentState, option, options);
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
