import { turnResultSchema, type TurnResult } from '@ag/schemas';

export interface TurnDebugView {
  turnId: string;
  runId: string;
  choiceOptionId: string;
  stateBefore: TurnResult['stateBefore'];
  directDelta: TurnResult['directDelta'];
  reactionNarrative: string;
  secondaryDelta: TurnResult['secondaryDelta'];
  newMemories: TurnResult['newMemories'];
  playerModel: TurnResult['playerModel'];
  worldUpdate: TurnResult['worldUpdate'];
  finalState: TurnResult['finalState'];
}

export class TurnDebugger {
  private readonly turns = new Map<string, TurnResult>();

  constructor(turnHistory: readonly TurnResult[]) {
    for (const turn of turnHistory) {
      const parsed = turnResultSchema.parse(turn);
      this.turns.set(parsed.turnId, parsed);
    }
  }

  list(): string[] {
    return [...this.turns.keys()];
  }

  debug(turnId: string): TurnDebugView {
    const turn = this.turns.get(turnId);
    if (!turn) throw new Error(`Unknown turnId: ${turnId}`);
    return {
      turnId: turn.turnId,
      runId: turn.runId,
      choiceOptionId: turn.choice.optionId,
      stateBefore: turn.stateBefore,
      directDelta: turn.directDelta,
      reactionNarrative: turn.reaction.narrative,
      secondaryDelta: turn.secondaryDelta,
      newMemories: turn.newMemories,
      playerModel: turn.playerModel,
      worldUpdate: turn.worldUpdate,
      finalState: turn.finalState,
    };
  }

  replayHead(n: number): TurnDebugView[] {
    return [...this.turns.values()].slice(0, n).map((turn) => this.debug(turn.turnId));
  }
}
