import { GameRuntime } from '@ag/runtime';
import type { Option } from '@ag/schemas';

export interface LivePlayOptions {
  turns?: number;
  seed?: number;
  env?: Record<string, string | undefined>;
}

interface TurnLog {
  index: number;
  day: number;
  time: string;
  weekday?: string;
  locationId: string;
  transition: {
    source: string;
    narration: string;
    dialogues: { speaker: string; text: string }[];
    referencedMemoryContents: string[];
    timeChange: { previous: string; current: string };
  } | null;
  scenario: { text: string; source: string };
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
  fallbackReaction: boolean;
}

export interface LivePlayReport {
  providerConfigured: boolean;
  turnsRequested: number;
  turnsCompleted: number;
  daysElapsed: number;
  ratio: { scenario: number; reaction: number; transition: number };
  transitionsGenerated: number;
  finalRelationship: { affection: number; trust: number; stress: number };
  activeMemoryCount: number;
  turns: TurnLog[];
}

const FALLBACK_REACTION = '……（NPC 没有回应。）';

/**
 * 真实 LLM 完整对局记录：逐轮导出过渡文段/情景/选项/选择/反应/影响，供人工检查。
 * Provider 经 LLM_* 环境变量配置；--demo 时使用内置 DemoProvider。
 */
export async function runLivePlaythrough(options: LivePlayOptions = {}): Promise<LivePlayReport> {
  const turnsRequested = options.turns ?? 20;
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const providerConfigured = Boolean(env.LLM_API_KEY);
  const runtime = providerConfigured ? new GameRuntime({ env }) : new GameRuntime({});
  runtime.startGame(options.seed ?? 20260822);

  const characterName = runtime.character.identity.name;
  const nameById = new Map(
    Object.entries(runtime.getState().characters).map(([id, character]) => [
      id,
      character.identity.name,
    ]),
  );
  const speakerLabel = (speakerId: string) => {
    if (speakerId === 'narrator') return '';
    if (speakerId === 'player') return '玩家';
    return nameById.get(speakerId) ?? characterName;
  };

  const turns: TurnLog[] = [];
  let scenarioLlm = 0;
  let reactionLlm = 0;
  let transitionsGenerated = 0;
  let transitionLlm = 0;

  for (let index = 0; index < turnsRequested; index += 1) {
    const startView = await runtime.startTurn();
    if (startView.scenario.source === 'llm') scenarioLlm += 1;

    const memoryContents = new Map(
      Object.values(startView.state.memories.records).map((record) => [record.id, record.content]),
    );

    const transition = startView.transition
      ? (() => {
          transitionsGenerated += 1;
          if (startView.transition!.narrative.source === 'llm') transitionLlm += 1;
          return {
            source: startView.transition!.narrative.source,
            narration: startView.transition.narrative.narration,
            dialogues: startView.transition.narrative.dialogues.map((dialogue) => ({
              speaker: speakerLabel(dialogue.speakerId),
              text: dialogue.text,
            })),
            referencedMemoryContents: (
              startView.transition.emotionalAftermath?.referencedMemoryIds ?? []
            ).map((id) => memoryContents.get(id) ?? id),
            timeChange: {
              previous: startView.transition.time.previous,
              current: startView.transition.time.current,
            },
          };
        })()
      : null;

    const optionLabels = startView.options.map((option, i) => describeOption(option, i));
    const option = startView.options[index % Math.max(1, startView.options.length)]!;
    const choice = await runtime.chooseOption(option.id);
    if (!choice.turnResult.reaction.narrative.startsWith('……（')) reactionLlm += 1;

    const relationshipDelta =
      choice.turnResult.directDelta.relationships?.[
        Object.keys(choice.turnResult.directDelta.relationships ?? {})[0] ?? ''
      ] ?? {};

    const secondaryCharacters = choice.turnResult.secondaryDelta.characters ?? {};
    const psychologyImpact = Object.entries(secondaryCharacters).flatMap(([charId, delta]) => [
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
    ]);

    const finalState = choice.turnResult.finalState;
    const relationship = Object.values(finalState.relationships)[0];
    const mainCharacter = Object.values(finalState.characters)[0];

    turns.push({
      index: index + 1,
      day: finalState.run.day,
      time: finalState.run.time,
      locationId: finalState.world.currentLocationId,
      transition,
      scenario: { text: startView.scenario.narrative, source: startView.scenario.source },
      options: optionLabels,
      choice: {
        label: optionLabels[startView.options.indexOf(option)]?.label ?? '',
        text: option.presentation.text,
        actions: [...option.behavior.actions],
      },
      reaction:
        choice.turnResult.reaction.narrative.length > 0
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
      psychologyImpact,
      newMemories: choice.turnResult.newMemories.map((record) => ({
        content: record.content,
        importance: record.importance,
      })),
      fallbackReaction: choice.reactionText === FALLBACK_REACTION,
    });
    void characterName;
    void relationship;
    void mainCharacter;
  }

  const finalState = runtime.getState();
  const forgotten = new Set(finalState.memories.forgottenIds);
  const finalRelationship = Object.values(finalState.relationships)[0];
  const finalCharacter = Object.values(finalState.characters)[0];

  return {
    providerConfigured,
    turnsRequested,
    turnsCompleted: turns.length,
    daysElapsed: finalState.run.day,
    ratio: {
      scenario: turns.length > 0 ? scenarioLlm / turns.length : 0,
      reaction: turns.length > 0 ? reactionLlm / turns.length : 0,
      transition: transitionsGenerated > 0 ? transitionLlm / transitionsGenerated : 0,
    },
    transitionsGenerated,
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
