import {
  modelContextSchema,
  type EventInstance,
  type GameState,
  type GenerationTask,
  type ModelContext,
} from '@ag/schemas';
import { retrieveMemories, type RetrievalQuery, type RetrievalWeights } from '@ag/memory';
import { allocateContextBudget } from './budget.js';
import { ContextCache } from './cache.js';
import { summarizeGameState } from './summarizer.js';

export interface ContextBuilderOptions {
  characterId?: string;
  systemRules?: string;
  cache?: ContextCache;
  currentEvent?: EventInstance;
  recentEvents?: EventInstance[];
  generationTask?: GenerationTask;
  query?: RetrievalQuery;
  retrievalWeights?: RetrievalWeights;
  /** 覆盖自动 Top-K；缺省由 budget.memories / 5 决定。 */
  memoryTopK?: number;
  turnId?: string;
}

/**
 * Stage 04 Context Assembly：
 * GameState + 检索记忆 + 当前事件 + 角色认知 → ModelContext。
 * 不同认知 Profile 会产生不同 budget/topK 与检索记忆。
 */
export function buildContext(state: GameState, options: ContextBuilderOptions = {}): ModelContext {
  const characterId = options.characterId ?? Object.keys(state.characters)[0];
  const character = characterId ? state.characters[characterId] : undefined;
  const capacity = character?.cognition.memoryCapacity ?? 50;
  const budget = allocateContextBudget(capacity);
  const topK = options.memoryTopK ?? Math.max(1, Math.round(budget.memories / 5));

  // Phase 6 机械近似：Phase 9 由 Turn 编排传入基于当前事件的 query 后，文本相关性会更明显。
  const query: RetrievalQuery = options.query ?? {
    tags: state.world.activeEvents.map((event) => event.eventId),
    text: summarizeGameState(state),
  };

  const retrievedMemories = character
    ? retrieveMemories(state, query, character.cognition, {
        topK,
        weights: options.retrievalWeights,
        currentDay: state.run.day,
      })
    : [];

  const defaultRules = '你是当前世界中的角色。保持角色一致性；输出双通道结构。';
  const baseRules =
    options.cache?.getSystemRules(
      characterId ?? 'default',
      () => options.systemRules ?? defaultRules,
    ) ??
    options.systemRules ??
    defaultRules;
  const stableSummary = options.cache?.getStableSummary(state, characterId ?? 'default') ?? '';
  const systemRules = [stableSummary, baseRules].filter(Boolean).join('\n');

  const turnNumber = state.run.turn + 1;
  const turnId =
    options.turnId ??
    `${state.run.runId}/day_${state.run.day.toString().padStart(3, '0')}/turn_${turnNumber
      .toString()
      .padStart(3, '0')}`;

  return modelContextSchema.parse({
    schemaVersion: '0.1.0',
    runId: state.run.runId,
    turnId,
    day: state.run.day,
    time: state.run.time,
    systemRules,
    currentState: state,
    currentEvent: options.currentEvent,
    recentEvents: options.recentEvents ?? [],
    retrievedMemories,
    internalState: character
      ? {
          characterId: character.characterId,
          emotion: character.emotion.primary,
          emotionIntensity: character.emotion.intensity,
          valence: character.emotion.valence,
          stress: character.psychology.stress,
          currentGoal: character.activity.currentGoal ?? 'idle',
        }
      : {},
    generationTask: options.generationTask ?? {
      task: 'generate_scenario_and_options',
      outputSchema: 'option.schema.json',
    },
    budget,
  });
}

export const contextBuilder = Object.freeze({ build: buildContext });
