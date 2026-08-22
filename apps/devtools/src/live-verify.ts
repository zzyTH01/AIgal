import { GameRuntime } from '@ag/runtime';
import type { Beat } from '@ag/schemas';

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
  /** P0.5：本 Turn 的文段拍数量（不含选择拍）。 */
  narrativeBeats: number;
  /** P0.5：文段拍 llm 来源数。 */
  narrativeBeatLlm: number;
  optionActions: string[];
  newMemories: number;
  recordCount: number;
  activeRecordCount: number;
  avgStrength: number;
  activeAvgStrength: number;
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
  /** P0.5：文段拍 llm 占比。 */
  narrativeBeatLlmRatio: number;
  totalNarrativeBeats: number;
  memoriesFormedTotal: number;
  finalRecordCount: number;
  /** 活跃记忆 = records 中未被遗忘标记的记录（可被检索召回）。 */
  activeRecordCount: number;
  forgottenCount: number;
  finalAvgStrength: number;
  activeAvgStrength: number;
  finalMaxStrength: number;
  saturatedRecords: number;
  reinforcement: {
    retrievalCountSum: number;
    /** 饱和观察：活跃记忆中 strength≥95 的占比。 */
    saturationRatio: number;
  };
  finalRelationship: { affection: number; trust: number; stress: number };
  perTurn: LiveTurnMetric[];
}

const FALLBACK_REACTION = '……（NPC 没有回应。）';

function memoryStats(state: ReturnType<GameRuntime['getState']>): {
  recordCount: number;
  activeRecordCount: number;
  avgStrength: number;
  activeAvgStrength: number;
  maxStrength: number;
  saturatedRecords: number;
  activeSaturatedRecords: number;
  retrievalCountSum: number;
} {
  const forgotten = new Set(state.memories.forgottenIds);
  const records = Object.values(state.memories.records);
  const active = records.filter((record) => !forgotten.has(record.id));
  const strengths = records.map((record) => record.strength);
  const activeStrengths = active.map((record) => record.strength);
  const sum = strengths.reduce((total, value) => total + value, 0);
  const activeSum = activeStrengths.reduce((total, value) => total + value, 0);
  return {
    recordCount: records.length,
    activeRecordCount: active.length,
    avgStrength: records.length > 0 ? Math.round((sum / records.length) * 10) / 10 : 0,
    activeAvgStrength: active.length > 0 ? Math.round((activeSum / active.length) * 10) / 10 : 0,
    maxStrength: strengths.length > 0 ? Math.max(...strengths) : 0,
    saturatedRecords: strengths.filter((value) => value >= 95).length,
    activeSaturatedRecords: activeStrengths.filter((value) => value >= 95).length,
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
  let totalNarrativeBeats = 0;
  let narrativeBeatLlm = 0;
  let formedTotal = 0;

  for (let index = 0; index < turnsRequested; index += 1) {
    const startView = await runtime.startTurn();
    if (startView.scenario.source === 'llm') scenarioLlm += 1;

    // P0.5：推进文段拍直到选择点，逐拍统计
    const allBeats: Beat[] = startView.beat ? [startView.beat] : [];
    let optionList = startView.options;
    if (optionList.length === 0) {
      let view = await runtime.advance();
      allBeats.push(view.beat);
      let guard = 0;
      while (view.flowPhase !== 'awaiting-choice' && guard < 10) {
        guard += 1;
        view = await runtime.advance();
        allBeats.push(view.beat);
      }
      optionList = view.options;
    }
    for (const beat of allBeats) {
      if (beat.kind === 'narrative') {
        totalNarrativeBeats += 1;
        if (beat.source === 'llm') narrativeBeatLlm += 1;
      }
    }

    const option = optionList[index % Math.max(1, optionList.length)]!;
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
      narrativeBeats: allBeats.filter((beat) => beat.kind === 'narrative').length,
      narrativeBeatLlm: allBeats.filter(
        (beat) => beat.kind === 'narrative' && beat.source === 'llm',
      ).length,
      reactionSource: reactionIsFallback ? 'inferred-fallback' : 'llm',
      optionActions: option.behavior.actions,
      newMemories: choice.turnResult.newMemories.length,
      recordCount: stats.recordCount,
      activeRecordCount: stats.activeRecordCount,
      avgStrength: stats.avgStrength,
      activeAvgStrength: stats.activeAvgStrength,
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
    narrativeBeatLlmRatio: totalNarrativeBeats > 0 ? narrativeBeatLlm / totalNarrativeBeats : 0,
    totalNarrativeBeats,
    memoriesFormedTotal: formedTotal,
    finalRecordCount: finalStats.recordCount,
    activeRecordCount: finalStats.activeRecordCount,
    forgottenCount: finalState.memories.forgottenIds.length,
    finalAvgStrength: finalStats.avgStrength,
    activeAvgStrength: finalStats.activeAvgStrength,
    finalMaxStrength: finalStats.maxStrength,
    saturatedRecords: finalStats.saturatedRecords,
    reinforcement: {
      retrievalCountSum: finalStats.retrievalCountSum,
      saturationRatio:
        finalStats.activeRecordCount > 0
          ? finalStats.activeSaturatedRecords / finalStats.activeRecordCount
          : 0,
    },
    finalRelationship: {
      affection: finalSnapshot.affection,
      trust: finalSnapshot.trust,
      stress: finalSnapshot.stress,
    },
    perTurn,
  };
}
