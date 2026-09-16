import { z } from 'zod';
import {
  branchPotentialSchema,
  transitionDialogueSchema,
  type GameState,
  type NarrativeBeat,
} from '@ag/schemas';
import { textSimilarity } from '@ag/core';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { planDiverseOptions, renderOptions, validateOptions } from '@ag/option';
import { parseStructuredResponse } from './structured-parser.js';
import { checkNarrativeConsistency } from './consistency-check.js';
import { plannedOptionSchema } from './option-planner.js';
import type { TransitionContextInput, TransitionGeneratorOptions } from './transition-generator.js';

export interface BeatContextInput extends TransitionContextInput {
  /** P0.5：事件内滚动上下文——文段是下一选项的土壤。 */
  flow: {
    beatsUsed: number;
    choicesUsed: number;
    beatSummaries: string[];
    /** #16 观察b：近期台词摘录（≤60 字符/条）——台词级去重候选。 */
    recentDialogues?: string[];
    pendingTension?: string;
  };
  /** Choice 区间结算摘要（选择后的首个文段拍必带）。 */
  lastChoiceResolution?: string;
  /**
   * P2 Autonomous Event：本事件由角色主动发起（玩家未到场，角色主动寻找玩家）。
   * summary 为驱动它的意图摘要；motive 为角色内心动机。
   */
  autonomous?: { summary: string; motive?: string };
  /** 可选：供选项条件评估。 */
  currentState?: GameState;
}

export type BeatGeneratorOptions = TransitionGeneratorOptions & { maxBeats?: 1 | 2 };

const DEFAULT_SIMILARITY_THRESHOLD = 0.45;

const narrativeBeatLlmSchema = z.object({
  narration: z.string().min(1),
  dialogues: z.array(transitionDialogueSchema).default([]),
  branchPotential: branchPotentialSchema.default('mid'),
  // V4 Flash 校准：模型常把 nextSuggestion 写成自由文本；引擎裁决原则下无效建议降级为 undefined，不报废整拍。
  nextSuggestion: z.unknown().optional(),
  emotionDrift: z.record(z.string(), z.number()).optional(),
  /** 思维链→扮演对象：角色此刻内心动机（引擎留存驱动后续拍，不呈现给玩家）。 */
  motive: z.string().max(200).optional(),
});

const narrativeBatchSchema = z.object({ beats: z.array(narrativeBeatLlmSchema).min(1).max(2) });

const choiceBeatLlmSchema = z.object({
  intro: z.string().max(160).optional(),
  options: z.array(plannedOptionSchema).min(2).max(4),
});

function buildBaseUserLines(input: BeatContextInput): string[] {
  const memoryLines = input.retrievedMemories.map(
    (memory, index) => `[检索记忆${index + 1}] id=${memory.id} ${memory.content}`,
  );
  const recent = input.flow.beatSummaries.slice(-3);
  const lastSummary = input.flow.beatSummaries[input.flow.beatSummaries.length - 1];
  return [
    `时间：${input.timeChange.previous} → ${input.timeChange.current}${input.timeChange.crossedDayBoundary ? '（跨天）' : ''}`,
    `地点：${input.locationChange.fromLocationId ?? '未知'} → ${input.locationChange.toLocationId}`,
    ...(input.flow.beatSummaries.length > 0
      ? [
          `[本事件已发生] ${input.flow.beatSummaries.map((summary, index) => `${index + 1}) ${summary}`).join(' ')}`,
        ]
      : []),
    // 校准 #15：显式列出禁用开头，滚动窗口续写而非重起场景
    ...(recent.length > 0 ? [`[禁止复用的开头描写] ${recent.join(' | ')}`] : []),
    // #16 观察b：列出近期台词，台词级去重 + 校正指令的对照面
    ...(input.flow.recentDialogues && input.flow.recentDialogues.length > 0
      ? [`[已发生台词] ${input.flow.recentDialogues.slice(-3).join(' | ')}`]
      : []),
    ...(lastSummary ? [`[续写起点] ${lastSummary}`] : []),
    ...(input.lastChoiceResolution ? [`[上一选择结果] ${input.lastChoiceResolution}`] : []),
    ...(input.flow.pendingTension ? [`[角色内心动机（延续）] ${input.flow.pendingTension}`] : []),
    ...memoryLines,
  ];
}

/** 文段拍生成：一次调用可返回 1–2 拍（D5 成本策略）。 */
export async function generateNarrativeBeats(
  input: BeatContextInput,
  gateway: LLMGateway,
  options: BeatGeneratorOptions = {},
): Promise<NarrativeBeat[]> {
  const maxAttempts = options.maxAttempts ?? 1;
  const maxBeats = options.maxBeats ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(
        buildNarrativeRequest(input, maxBeats, options, attempt > 0),
      );
      const parsed = parseStructuredResponse(response.text, narrativeBatchSchema);
      const issues = checkNarrativeConsistency(parsed.beats[0]?.narration ?? '', {
        forbiddenTopics: options.consistency?.forbiddenTopics,
        allowedCharacters: options.consistency?.allowedCharacters,
      });
      if (issues.length > 0) throw new Error(`beat consistency: ${issues.join('; ')}`);
      // 拍间去重：开头对开头（beatSummaries 即上一拍前 60 字符；长文本全文 Jaccard 会被稀释，#15 教训）
      const recent = input.flow.beatSummaries.slice(-2);
      // #16 观察b：台词级去重——候选含历史台词摘录与同批次已接受拍的台词。
      const recentDialogues = input.flow.recentDialogues?.slice(-4) ?? [];
      const dialogueCandidates = [...recentDialogues];
      const narrationCandidates = [...recent];
      // 同批次顺序检查：先接受的拍成为后续拍的候选（批次内互查 + 历史候选）。
      for (const payload of parsed.beats.slice(0, maxBeats)) {
        const narrationRepeated = overlapsAny(payload.narration.slice(0, 60), narrationCandidates);
        const dialogueRepeated = (payload.dialogues ?? []).some(
          (dialogue) =>
            dialogue.text.length > 0 && overlapsAny(dialogue.text.slice(0, 60), dialogueCandidates),
        );
        if (narrationRepeated || dialogueRepeated) {
          throw new Error('beat repeats recent narration or dialogue');
        }
        narrationCandidates.push(payload.narration.slice(0, 60));
        for (const dialogue of payload.dialogues ?? []) {
          if (dialogue.text.length > 0) dialogueCandidates.push(dialogue.text.slice(0, 60));
        }
      }
      return parsed.beats.slice(0, maxBeats).map((payload, index) => ({
        beatId: `${input.flow.beatsUsed + index + 1}`.padStart(3, '0'),
        kind: 'narrative',
        narration: payload.narration,
        dialogues: payload.dialogues ?? [],
        source: 'llm',
        branchPotential: payload.branchPotential ?? 'mid',
        nextSuggestion:
          payload.nextSuggestion === 'choice' ||
          payload.nextSuggestion === 'beat' ||
          payload.nextSuggestion === 'end'
            ? payload.nextSuggestion
            : undefined,
        emotionDrift: payload.emotionDrift,
        motive: payload.motive,
      }));
    } catch (error) {
      if (process.env.LLM_DEBUG) {
        console.error(
          `[beat-debug] narrative attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
      if (error instanceof LLMError && !error.retryable) break;
    }
  }
  return [fallbackNarrativeBeat(input)];
}

export function fallbackNarrativeBeat(input: BeatContextInput): NarrativeBeat {
  const afterthought =
    input.lastChoiceResolution !== undefined
      ? '刚才的选择仍萦绕在心头。'
      : input.flow.beatSummaries.length > 0
        ? '前事历历，思绪未散。'
        : '';
  // P2：自主发起事件的 fallback 保留"角色主动出现"语义（纯文本闭环基线）。
  if (input.autonomous) {
    return {
      beatId: `${input.flow.beatsUsed + 1}`.padStart(3, '0'),
      kind: 'narrative',
      narration: `（${input.timeChange.current}，${input.locationChange.toLocationId}）${input.npcName}主动走到「我」面前，神情认真。有件事她一直放在心上，此刻不想再等。`,
      dialogues: [],
      source: 'fallback',
      branchPotential: 'mid',
    };
  }
  return {
    beatId: `${input.flow.beatsUsed + 1}`.padStart(3, '0'),
    kind: 'narrative',
    narration: `（${input.timeChange.current}，${input.locationChange.toLocationId}）短暂的静默中，时间缓缓流过。${afterthought}`,
    dialogues: [],
    source: 'fallback',
    branchPotential: 'mid',
  };
}

/** 去重防线③：文本与任一候选相似度超阈值即视为重合。 */
export function overlapsAny(
  text: string,
  candidates: string[],
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): boolean {
  return candidates.some((candidate) => textSimilarity(text, candidate) > threshold);
}

export interface ChoiceBeatResult {
  beatId: string;
  kind: 'choice';
  intro?: string;
  options: ReturnType<typeof renderOptions>;
  source: 'llm' | 'fallback';
}

/**
 * 选择拍生成：极简引子 + 2–4 选项。
 * 引子与选项文本相似度超阈值 → retry → fallback（治"文段与选项重合"）。
 */
export async function generateChoiceBeat(
  input: BeatContextInput,
  gateway: LLMGateway,
  options: TransitionGeneratorOptions & { minOptions?: number } = {},
): Promise<ChoiceBeatResult> {
  const maxAttempts = options.maxAttempts ?? 1;
  const minOptions = options.minOptions ?? 4;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildChoiceRequest(input, options));
      const parsed = parseStructuredResponse(response.text, choiceBeatLlmSchema);
      const rendered = renderOptions(parsed.options);
      if (
        rendered.length < minOptions ||
        !validateOptions(rendered, { gameState: input.currentState, diversityMode: 'soft' }).valid
      ) {
        if (process.env.LLM_DEBUG) {
          console.error('[beat-debug] choice rejected: too few options or validation failed');
        }
        continue;
      }
      if (
        parsed.intro &&
        overlapsAny(
          parsed.intro,
          rendered.map((option) => option.presentation.text),
        )
      ) {
        throw new Error('choice beat intro overlaps options');
      }
      return {
        beatId: `${input.flow.beatsUsed + 1}`.padStart(3, '0'),
        kind: 'choice',
        intro: parsed.intro,
        options: rendered,
        source: 'llm',
      };
    } catch (error) {
      if (process.env.LLM_DEBUG) {
        console.error(
          `[beat-debug] choice attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
      if (error instanceof LLMError && !error.retryable) break;
    }
  }

  return {
    beatId: `${input.flow.beatsUsed + 1}`.padStart(3, '0'),
    kind: 'choice',
    options: renderOptions(planDiverseOptions(Math.max(minOptions, 4))),
    source: 'fallback',
  };
}

function buildNarrativeRequest(
  input: BeatContextInput,
  maxBeats: number,
  options: BeatGeneratorOptions,
  isRetry = false,
): LLMRequest {
  return {
    model: options.model,
    temperature: 0.7,
    maxTokens: 1024,
    messages: [
      {
        role: 'system',
        content:
          input.systemRules ??
          '你是叙事旁白系统：输出事件内连续叙事流的文段拍，保持世界连续性与角色一致性。',
      },
      {
        role: 'user',
        content: [
          `【任务】为「${input.npcName}」的事件生成 ${maxBeats} 个文段拍（旁白+对话）。`,
          ...(input.autonomous
            ? [
                `【自主发起】本事件由「${input.npcName}」主动发起——玩家没有去找她，是她主动来寻找玩家。开场必须从她的主动行为切入（主动出现/叫住玩家/走到面前）。`,
                `【自主动机】她的目的是：${input.autonomous.summary}${input.autonomous.motive ? `（内心：${input.autonomous.motive}）` : ''}。`,
                '【记忆驱动】若 [检索记忆] 中有与此相关的过去事件，让她在开场自然提及（示例语气："……等等。昨天你说的那些话，我后来想了很久。"），不要生硬复述记忆原文。',
              ]
            : []),
          ...(isRetry
            ? [
                '【校正】上一次输出因与近期拍的旁白或台词重复被拒绝。你必须选择一个与所有已列出开头完全不同的场景、动作或视角切入，不要从同一场景重新描写；台词不得与[已发生台词]重复或仅有微小变化。',
              ]
            : []),
          ...buildBaseUserLines(input),
          ...(input.retrievedMemories.length > 0
            ? ['若检索记忆与本拍相关，在文中自然呼应。']
            : ['没有可用检索记忆时，不要虚构记忆引用。']),
          `【视角契约（角色 Agent）】旁白以玩家第一人称「我」的视角叙述（galgame 主人公声音）：写「我」的所见所感、环境流动，以及「${input.npcName}」的可观察言行。她的内心活动禁止写入旁白——只允许写入 motive 字段（引擎留存，不呈现给玩家），旁白只能呈现可观察的外在流露。`,
          '【职责边界】文段只写：上一选择的余波、时间/地点/环境流动、角色的可观察行为、张力铺垫。禁止描写玩家未做出的任何新行动，禁止替玩家做决定。',
          '【连续性】从[续写起点]自然续写；严禁复用或改写[禁止复用的开头描写]中的任何句子作为开头；每一拍必须出现新的情节细节、动作或内心变化。',
          '【思维链】先用 motive 字段写下角色此刻的内心动机（一句话，引擎留存、不呈现给玩家），再让旁白与对话成为该动机的外在流露——动机要延续[角色内心动机（延续）]并向前演化。',
          `对话 speakerId 必须使用「${input.npcId ?? input.npcName}」，不要自创角色 ID。`,
          '每个文段拍给出 branchPotential（high/mid/low，此处是否值得让玩家做出有分歧的选择）与 nextSuggestion（必须是 "choice"、"beat"、"end" 三个字符串之一，不得写其他内容）。',
          '严格输出 JSON：',
          '{"beats":[{"narration":"旁白","dialogues":[{"speakerId":"角色ID","text":"台词"}],"branchPotential":"mid","nextSuggestion":"beat","emotionDrift":{"valence":1},"motive":"角色此刻内心动机一句话"}]}',
        ].join('\n'),
      },
    ],
  };
}

function buildChoiceRequest(
  input: BeatContextInput,
  options: TransitionGeneratorOptions & { minOptions?: number },
): LLMRequest {
  return {
    model: options.model,
    temperature: 0.8,
    maxTokens: 1536,
    messages: [
      {
        role: 'system',
        content: input.systemRules ?? '你是叙事系统：此刻到了玩家可以行动的节点。',
      },
      {
        role: 'user',
        content: [
          `【任务】基于以下上下文，生成选择点：一句极简引子（≤40字）+ 4 个玩家对「${input.npcName}」的行为选项。`,
          ...buildBaseUserLines(input),
          ...(input.retrievedMemories.length > 0
            ? ['若检索记忆与本节点相关，请在选项或引子中自然呼应。']
            : []),
          '【职责边界】引子只描述"此刻可行动的局面"，禁止复述选项内容；选项必须是玩家对 NPC 的行动，覆盖主动/保守/社交关系/风险四类。',
          `对话与引子中如需指代角色，使用「${input.npcId ?? input.npcName}」。`,
          'conditions 只允许 {} 或 {"<flag>": boolean|number|"字符串"}；不要输出数组/null/嵌套对象。',
          '严格输出 JSON：',
          '{"intro":"极简引子","options":[{"id":"option_001","presentation":{"text":"自然语言选项","tone":"..."},"behavior":{"actions":["support"],"intent":["care"],"risk":0.15},"gameplay":{"progress":2},"effects":{"affection":{"base":2}},"conditions":{},"generation":{"must_fit_character":true,"must_fit_context":true,"variation":"high"}}]}',
        ].join('\n'),
      },
    ],
  };
}
