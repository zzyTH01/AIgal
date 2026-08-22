import { GameRuntime } from '@ag/runtime';
import type { Beat, Option } from '@ag/schemas';

export interface LivePlayOptions {
  turns?: number;
  seed?: number;
  env?: Record<string, string | undefined>;
}

interface BeatLog {
  kind: 'narrative' | 'choice';
  source: string;
  narration?: string;
  dialogues?: { speaker: string; text: string }[];
  intro?: string;
  branchPotential?: string;
}

interface TurnLog {
  index: number;
  day: number;
  time: string;
  locationId: string;
  eventImportance: string;
  beats: BeatLog[];
  options: { label: string; text: string; actions: string[]; intent: string[]; risk: number }[];
  choice: { label: string; text: string; actions: string[] } | null;
  reaction: { text: string; source: string } | null;
  relationshipImpact: { metric: string; before: number; after: number; delta: number }[];
  psychologyImpact: {
    name: string;
    metric: string;
    before: number;
    after: number;
    delta: number;
  }[];
  newMemories: { content: string; importance: number }[];
}

export interface LivePlayReport {
  providerConfigured: boolean;
  turnsRequested: number;
  turnsCompleted: number;
  daysElapsed: number;
  ratio: {
    narrativeBeatLlm: number;
    choiceBeatLlm: number;
    reaction: number;
  };
  totalNarrativeBeats: number;
  totalChoicePoints: number;
  finalRelationship: { affection: number; trust: number; stress: number };
  activeMemoryCount: number;
  turns: TurnLog[];
}

const FALLBACK_REACTION = '……（NPC 没有回应。）';

/** 推进当前流的文段拍，直到出现选择点。 */
async function advanceUntilChoice(
  runtime: GameRuntime,
): Promise<{ beats: Beat[]; options: Option[] }> {
  const beats: Beat[] = [];
  let view = await runtime.advance();
  beats.push(view.beat);
  let guard = 0;
  while (view.flowPhase !== 'awaiting-choice' && guard < 10) {
    guard += 1;
    view = await runtime.advance();
    beats.push(view.beat);
  }
  return { beats, options: view.options };
}

/**
 * 真实 LLM 完整对局记录（P0.5 拍驱动）：逐轮导出文段拍序列/选择点/选项/反应/影响。
 * Provider 经 LLM_* 环境变量配置；--demo 时使用内置 DemoProvider。
 */
export async function runLivePlaythrough(options: LivePlayOptions = {}): Promise<LivePlayReport> {
  const turnsRequested = options.turns ?? 20;
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const providerConfigured = Boolean(env.LLM_API_KEY);
  const runtime = providerConfigured ? new GameRuntime({ env }) : new GameRuntime({});
  runtime.startGame(options.seed ?? 20260822);

  const npcName = runtime.character.identity.name;
  const speakerLabel = (speakerId: string) => {
    if (speakerId === 'player') return '玩家';
    if (speakerId === 'narrator') return '';
    return npcName;
  };

  const turns: TurnLog[] = [];
  let narrativeBeats = 0;
  let narrativeLlm = 0;
  let choicePoints = 0;
  let choiceLlm = 0;

  for (let index = 0; index < turnsRequested; index += 1) {
    const startView = await runtime.startTurn();
    let allBeats: Beat[] = startView.beat ? [startView.beat] : [];
    let optionList = startView.options;

    if (optionList.length === 0) {
      const advanced = await advanceUntilChoice(runtime);
      allBeats = [...allBeats, ...advanced.beats];
      optionList = advanced.options;
    }

    const beatLogs: BeatLog[] = allBeats.map((beat) => {
      if (beat.kind === 'narrative') {
        narrativeBeats += 1;
        if (beat.source === 'llm') narrativeLlm += 1;
        return {
          kind: 'narrative',
          source: beat.source,
          narration: beat.narration,
          dialogues: beat.dialogues.map((dialogue) => ({
            speaker: speakerLabel(dialogue.speakerId),
            text: dialogue.text,
          })),
          branchPotential: beat.branchPotential,
        };
      }
      choicePoints += 1;
      if (beat.source === 'llm') choiceLlm += 1;
      return { kind: 'choice', source: beat.source, intro: beat.intro };
    });

    const optionLabels = optionList.map((option, i) => describeOption(option, i));
    const chosen = optionList[index % Math.max(1, optionList.length)]!;
    const choice = await runtime.chooseOption(chosen.id);
    const result = choice.turnResult;
    if (!choice.reactionText.startsWith('……（')) {
      // reaction 计入反应占比
    }

    const relationshipDelta =
      result.directDelta.relationships?.[
        Object.keys(result.directDelta.relationships ?? {})[0] ?? ''
      ] ?? {};
    const secondaryCharacters = result.secondaryDelta.characters ?? {};

    turns.push({
      index: index + 1,
      day: result.finalState.run.day,
      time: result.finalState.run.time,
      locationId: result.finalState.world.currentLocationId,
      eventImportance: runtime.getFlowState()?.importance ?? 'side',
      beats: beatLogs,
      options: optionLabels,
      choice: {
        label: optionLabels[optionList.indexOf(chosen)]?.label ?? '',
        text: chosen.presentation.text,
        actions: [...chosen.behavior.actions],
      },
      reaction:
        result.reaction.narrative.length > 0
          ? {
              text: choice.reactionText,
              source: choice.reactionText === FALLBACK_REACTION ? 'fallback' : 'llm',
            }
          : null,
      relationshipImpact: Object.entries(relationshipDelta).map(([metric, change]) => ({
        metric,
        before: change.before,
        after: change.after,
        delta: change.delta,
      })),
      psychologyImpact: Object.entries(secondaryCharacters).flatMap(([charId, delta]) => [
        ...Object.entries(delta.psychology ?? {}).map(([metric, change]) => ({
          name: charId,
          metric,
          before: change.before,
          after: change.after,
          delta: change.delta,
        })),
        ...Object.entries(delta.emotion ?? {}).map(([metric, change]) => ({
          name: charId,
          metric: `emotion.${metric}`,
          before: change.before,
          after: change.after,
          delta: change.delta,
        })),
      ]),
      newMemories: result.newMemories.map((record) => ({
        content: record.content,
        importance: record.importance,
      })),
    });
  }

  const finalState = runtime.getState();
  const forgotten = new Set(finalState.memories.forgottenIds);
  const finalRelationship = Object.values(finalState.relationships)[0];
  const finalCharacter = Object.values(finalState.characters)[0];
  const reactionLlm = turns.filter((turn) => turn.reaction?.source === 'llm').length;

  return {
    providerConfigured,
    turnsRequested,
    turnsCompleted: turns.length,
    daysElapsed: finalState.run.day,
    ratio: {
      narrativeBeatLlm: narrativeBeats > 0 ? narrativeLlm / narrativeBeats : 0,
      choiceBeatLlm: choicePoints > 0 ? choiceLlm / choicePoints : 0,
      reaction: turns.length > 0 ? reactionLlm / turns.length : 0,
    },
    totalNarrativeBeats: narrativeBeats,
    totalChoicePoints: choicePoints,
    finalRelationship: {
      affection: finalRelationship?.affection ?? 0,
      trust: finalRelationship?.trust ?? 0,
      stress: finalCharacter?.psychology.stress ?? 0,
    },
    activeMemoryCount: Object.values(finalState.memories.records).filter(
      (record) => !forgotten.has(record.id),
    ).length,
    turns,
  };
}

function describeOption(option: Option, index: number) {
  return {
    label: `${index + 1}`,
    text: option.presentation.text,
    actions: [...option.behavior.actions],
    intent: [...option.behavior.intent],
    risk: option.behavior.risk,
  };
}
