import type {
  EndingDefinition,
  EventDefinition,
  GameState,
  MemoryCandidate,
  Option,
  TurnResult,
} from '@ag/schemas';
import {
  createGameState,
  defaultRelationship,
  definitionToGameCharacter,
  startTurn,
  type RNG,
} from '@ag/core';
import { EventPool, XorShift128Rng, commitTriggeredEvent } from '@ag/world';
import { renderOptions, planDiverseOptions } from '@ag/option';
import { consolidateMemories, formMemory, pruneMemories } from '@ag/memory';
import { buildContext } from '@ag/context';
import { applyEnding, selectEnding } from '@ag/core';
import { demoCharacter, demoEvents } from '@ag/runtime';

export interface SimulationOptions {
  runs?: number;
  turnsPerRun?: number;
  seedBase?: number;
  maxMemoryRecords?: number;
  endings?: EndingDefinition[];
  costPerInputToken?: number;
  costPerOutputToken?: number;
  /** 模拟世界使用的事件定义；缺省 demoEvents。 */
  eventDefinitions?: readonly EventDefinition[];
  /** 真实 LLM 联调时注入每 Turn 的 token 估算。 */
  inputTokensPerTurn?: number;
  outputTokensPerTurn?: number;
}

export interface RunSimulationResult {
  seed: number;
  turns: number;
  day: number;
  affection: number;
  trust: number;
  memoryRecords: number;
  contextBudget: number;
  contextMemories: number;
  selectedEventIds: string[];
  selectedOptionIds: string[];
  turnResults: TurnResult[];
  ending?: string;
}

export interface SimulationReport {
  runs: number;
  completedTurns: number;
  estimatedCalls: number;
  endedRuns: number;
  endingDistribution: Record<string, number>;
  avgDay: number;
  avgTurn: number;
  avgAffection: number;
  avgTrust: number;
  avgMemoryRecords: number;
  avgContextBudget: number;
  avgContextMemories: number;
  eventFrequency: Record<string, number>;
  optionFrequency: Record<string, number>;
  estimatedCostUsd: number;
  fingerprint: string;
}

const DEFAULT_ENDINGS: EndingDefinition[] = [
  {
    endingId: 'ending_good',
    kind: 'good',
    title: 'Good End',
    description: '好感与信任达标。',
    conditions: { 'relationship.affection': { min: 60 }, 'relationship.trust': { min: 60 } },
    priority: 30,
  },
  {
    endingId: 'ending_bad',
    kind: 'bad',
    title: 'Bad End',
    description: '信任崩塌。',
    conditions: { 'run.turn': { min: 5 }, 'relationship.conflict': { min: 30 } },
    priority: 50,
  },
  {
    endingId: 'ending_normal_day5',
    kind: 'normal',
    title: 'Normal End',
    description: '第五天结束。',
    conditions: { 'run.day': { min: 5 } },
    priority: 10,
  },
];

export function simulateRuns(options: SimulationOptions = {}): SimulationReport {
  const runs = options.runs ?? 100;
  const turnsPerRun = options.turnsPerRun ?? 50;
  const seedBase = options.seedBase ?? 1000;
  const endings = options.endings ?? DEFAULT_ENDINGS;

  const results: RunSimulationResult[] = [];
  for (let index = 0; index < runs; index += 1) {
    results.push(simulateRun(index + seedBase, turnsPerRun, endings, options));
  }

  const report = aggregateReport(results, options);
  report.fingerprint = fingerprint(report);
  return report;
}

export function simulateRun(
  seed: number,
  turnsPerRun: number,
  endings: readonly EndingDefinition[],
  options: SimulationOptions = {},
): RunSimulationResult {
  const rng = new XorShift128Rng(seed);
  const optionsList: Option[] = renderOptions(planDiverseOptions(4));
  const eventDefinitions = options.eventDefinitions ?? demoEvents;
  const pool = new EventPool(eventDefinitions);
  const selectedEventIds: string[] = [];
  const selectedOptionIds: string[] = [];
  const turnResults: TurnResult[] = [];
  const contextBudgetSamples: number[] = [];
  const contextMemorySamples: number[] = [];
  let ending: string | undefined;

  let state = createGameState({ runId: `run_${seed}`, seed, day: 1, time: '09:00' });
  state.characters[demoCharacter.characterId] = definitionToGameCharacter(demoCharacter);
  state.relationships.rel_player = defaultRelationship(
    'player',
    demoCharacter.characterId,
    'rel_player',
    { type: demoCharacter.relationshipDefaults.initialType },
  );
  state.rng = rng.save();

  for (let turnIndex = 0; turnIndex < turnsPerRun; turnIndex += 1) {
    const selectedEvent = pool.trySelectEvent(state, rng);
    if (selectedEvent) {
      selectedEventIds.push(selectedEvent.eventId);
      state = commitTriggeredEvent(
        state,
        eventDefinitions.find((event) => event.eventId === selectedEvent.eventId)!,
        selectedEvent,
        pool,
      );
    }

    const option = optionsList[turnIndex % optionsList.length]!;
    selectedOptionIds.push(option.id);
    const transaction = startTurn(state);
    const resolution = transaction.resolveChoice(option, { rng });
    let next = transaction.getState();

    const candidate: MemoryCandidate = {
      type: 'episodic',
      content: `玩家选择了 ${option.presentation.text}`,
      importance: 40,
      emotionalIntensity: 25,
      valence: 10,
      tags: option.behavior.actions,
      relatedCharacters: [demoCharacter.characterId],
      sourceTurnId: resolution.turnId,
    };
    const formed = formMemory(
      next,
      candidate,
      next.characters[demoCharacter.characterId]!.cognition,
    );
    next = formed.state;
    if (resolution.crossedDayBoundary) {
      next = consolidateMemories(
        next,
        state.run.day,
        next.characters[demoCharacter.characterId]!.cognition,
      );
    }
    next = pruneMemories(next, { maxRecords: options.maxMemoryRecords ?? 100 });
    transaction.settle(() => next);

    const turnResult = transaction.commitTurn();
    turnResults.push(turnResult);
    state = turnResult.finalState;

    const turnContext = buildContext(state, { characterId: demoCharacter.characterId });
    contextBudgetSamples.push(turnContext.budget.capacity);
    contextMemorySamples.push(turnContext.retrievedMemories.length);

    const selectedEnding = selectEnding(state, endings);
    if (selectedEnding) {
      state = applyEnding(state, selectedEnding);
      ending = selectedEnding.endingId;
      break;
    }
  }

  const relationship = state.relationships.rel_player;
  return {
    seed,
    turns: state.run.turn,
    day: state.run.day,
    affection: relationship?.affection ?? 0,
    trust: relationship?.trust ?? 0,
    memoryRecords: Object.keys(state.memories.records).length,
    contextBudget: avg(contextBudgetSamples),
    contextMemories: avg(contextMemorySamples),
    selectedEventIds,
    selectedOptionIds,
    turnResults,
    ending,
  };
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateReport(
  results: RunSimulationResult[],
  options: SimulationOptions,
): SimulationReport {
  const avgValues = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  const eventFrequency: Record<string, number> = {};
  const optionFrequency: Record<string, number> = {};
  for (const result of results) {
    for (const id of result.selectedEventIds) eventFrequency[id] = (eventFrequency[id] ?? 0) + 1;
    for (const id of result.selectedOptionIds) optionFrequency[id] = (optionFrequency[id] ?? 0) + 1;
  }

  const completedTurns = results.reduce((sum, result) => sum + result.turnResults.length, 0);
  // TODO(真实 LLM)：当前为启发式成本估算；接入 usageListener 后替换为真实 token 用量。
  const estimatedCalls = completedTurns * 2;
  const estimatedInputTokens = completedTurns * (options.inputTokensPerTurn ?? 1200);
  const estimatedOutputTokens = completedTurns * (options.outputTokensPerTurn ?? 400);
  const estimatedCostUsd =
    (estimatedInputTokens / 1000) * (options.costPerInputToken ?? 0) +
    (estimatedOutputTokens / 1000) * (options.costPerOutputToken ?? 0);

  return {
    runs: results.length,
    completedTurns,
    estimatedCalls,
    endedRuns: results.filter((result) => result.ending !== undefined).length,
    endingDistribution: results.reduce<Record<string, number>>((acc, result) => {
      if (result.ending) acc[result.ending] = (acc[result.ending] ?? 0) + 1;
      return acc;
    }, {}),
    avgDay: avgValues(results.map((result) => result.day)),
    avgTurn: avgValues(results.map((result) => result.turns)),
    avgAffection: avgValues(results.map((result) => result.affection)),
    avgTrust: avgValues(results.map((result) => result.trust)),
    avgMemoryRecords: avgValues(results.map((result) => result.memoryRecords)),
    avgContextBudget: avgValues(results.map((result) => result.contextBudget)),
    avgContextMemories: avgValues(results.map((result) => result.contextMemories)),
    eventFrequency,
    optionFrequency,
    estimatedCostUsd,
    fingerprint: '',
  };
}

export function fingerprint(report: SimulationReport): string {
  const payload = JSON.stringify({
    runs: report.runs,
    completedTurns: report.completedTurns,
    estimatedCalls: report.estimatedCalls,
    endedRuns: report.endedRuns,
    endingDistribution: report.endingDistribution,
    avgDay: report.avgDay,
    avgTurn: report.avgTurn,
    avgAffection: report.avgAffection,
    avgTrust: report.avgTrust,
    avgMemoryRecords: report.avgMemoryRecords,
    avgContextBudget: report.avgContextBudget,
    avgContextMemories: report.avgContextMemories,
    eventFrequency: report.eventFrequency,
    optionFrequency: report.optionFrequency,
    estimatedCostUsd: report.estimatedCostUsd,
  });
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createSimulationRng(seed: number): RNG {
  return new XorShift128Rng(seed);
}

export type { GameState };
