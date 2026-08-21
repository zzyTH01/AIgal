import { GameRuntime } from '@ag/runtime';

export interface LiveVerifyOptions {
  turns?: number;
  seed?: number;
  env?: Record<string, string | undefined>;
}

export interface LiveTurnMetric {
  turn: number;
  day: number;
  time: string;
  scenarioSource: 'llm' | 'fallback';
  reactionSource: 'llm' | 'fallback' | 'inferred-fallback';
  optionActions: string[];
  newMemories: number;
  recordCount: number;
  avgStrength: number;
  maxStrength: number;
  saturatedRecords: number;
  retrievalCountSum: number;
  affection: number;
  trust: number;
  stress: number;
  playerModelCaring: number;
}

export interface LiveVerifyReport {
  providerConfigured: boolean;
  turnsRequested: number;
  turnsCompleted: number;
  daysElapsed: number;
  scenarioLlmRatio: number;
  reactionLlmRatio: number;
  memoriesFormedTotal: number;
  finalRecordCount: number;
  forgottenCount: number;
  finalAvgStrength: number;
  finalMaxStrength: number;
  saturatedRecords: number;
  reinforcement: {
    retrievalCountSum: number;
    /** 检索强化饱和观察：strength≥95 的记录占比。 */
    saturationRatio: number;
  };
  finalRelationship: { affection: number; trust: number; stress: number };
  perTurn: LiveTurnMetric[];
}

const FALLBACK_REACTION = '……（NPC 没有回应。）';

function memoryStats(state: ReturnType<GameRuntime['getState']>): {
  recordCount: number;
  avgStrength: number;
  maxStrength: number;
  saturatedRecords: number;
  retrievalCountSum: number;
} {
  const records = Object.values(state.memories.records);
  const strengths = records.map((record) => record.strength);
  const sum = strengths.reduce((total, value) => total + value, 0);
  return {
    recordCount: records.length,
    avgStrength: records.length > 0 ? Math.round((sum / records.length) * 10) / 10 : 0,
    maxStrength: strengths.length > 0 ? Math.max(...strengths) : 0,
    saturatedRecords: strengths.filter((value) => value >= 95).length,
    retrievalCountSum: records.reduce((total, record) => total + record.retrievalCount, 0),
  };
}

function relationshipSnapshot(state: ReturnType<GameRuntime['getState']>): {
  affection: number;
  trust: number;
  stress: number;
  caring: number;
} {
  const relationship = Object.values(state.relationships)[0];
  const character = Object.values(state.characters)[0];
  return {
    affection: relationship?.affection ?? 0,
    trust: relationship?.trust ?? 0,
    stress: character?.psychology.stress ?? 0,
    caring: state.playerModel.caring,
  };
}

/**
 * 真实 LLM 长对话复验：逐轮记录 source 占比、记忆形成/强化/修剪与关系演化。
 * Provider 经 LLM_* 环境变量配置（如 DeepSeek：LLM_PROVIDER=openai-compatible +
 * LLM_BASE_URL=https://api.deepseek.com LLM_MODEL=deepseek-chat LLM_API_KEY=...）。
 */
export async function runLiveVerification(
  options: LiveVerifyOptions = {},
): Promise<LiveVerifyReport> {
  const turnsRequested = options.turns ?? 30;
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const providerConfigured = Boolean(env.LLM_API_KEY);
  const runtime = providerConfigured ? new GameRuntime({ env }) : new GameRuntime({});
  runtime.startGame(options.seed ?? 20260821);

  const perTurn: LiveTurnMetric[] = [];
  let scenarioLlm = 0;
  let reactionLlm = 0;
  let formedTotal = 0;

  for (let index = 0; index < turnsRequested; index += 1) {
    const startView = await runtime.startTurn();
    if (startView.scenario.source === 'llm') scenarioLlm += 1;

    const option = startView.options[index % Math.max(1, startView.options.length)]!;
    const choice = await runtime.chooseOption(option.id);
    const reactionIsFallback =
      choice.turnResult.reaction.narrative === FALLBACK_REACTION ||
      choice.reactionText === FALLBACK_REACTION;
    if (!reactionIsFallback) reactionLlm += 1;

    formedTotal += choice.turnResult.newMemories.length;
    const stats = memoryStats(choice.state);
    const snapshot = relationshipSnapshot(choice.state);
    perTurn.push({
      turn: choice.state.run.turn,
      day: choice.state.run.day,
      time: choice.state.run.time,
      scenarioSource: startView.scenario.source,
      reactionSource: reactionIsFallback ? 'inferred-fallback' : 'llm',
      optionActions: option.behavior.actions,
      newMemories: choice.turnResult.newMemories.length,
      recordCount: stats.recordCount,
      avgStrength: stats.avgStrength,
      maxStrength: stats.maxStrength,
      saturatedRecords: stats.saturatedRecords,
      retrievalCountSum: stats.retrievalCountSum,
      affection: snapshot.affection,
      trust: snapshot.trust,
      stress: snapshot.stress,
      playerModelCaring: snapshot.caring,
    });
  }

  const finalState = runtime.getState();
  const finalStats = memoryStats(finalState);
  const finalSnapshot = relationshipSnapshot(finalState);

  return {
    providerConfigured,
    turnsRequested,
    turnsCompleted: perTurn.length,
    daysElapsed: finalState.run.day,
    scenarioLlmRatio: perTurn.length > 0 ? scenarioLlm / perTurn.length : 0,
    reactionLlmRatio: perTurn.length > 0 ? reactionLlm / perTurn.length : 0,
    memoriesFormedTotal: formedTotal,
    finalRecordCount: finalStats.recordCount,
    forgottenCount: finalState.memories.forgottenIds.length,
    finalAvgStrength: finalStats.avgStrength,
    finalMaxStrength: finalStats.maxStrength,
    saturatedRecords: finalStats.saturatedRecords,
    reinforcement: {
      retrievalCountSum: finalStats.retrievalCountSum,
      saturationRatio:
        finalStats.recordCount > 0 ? finalStats.saturatedRecords / finalStats.recordCount : 0,
    },
    finalRelationship: {
      affection: finalSnapshot.affection,
      trust: finalSnapshot.trust,
      stress: finalSnapshot.stress,
    },
    perTurn,
  };
}
