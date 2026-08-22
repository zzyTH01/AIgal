import { z } from 'zod';
import {
  branchPotentialSchema,
  nextStepSuggestionSchema,
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
    pendingTension?: string;
  };
  /** Choice 区间结算摘要（选择后的首个文段拍必带）。 */
  lastChoiceResolution?: string;
  /** 可选：供选项条件评估。 */
  currentState?: GameState;
}

export type BeatGeneratorOptions = TransitionGeneratorOptions & { maxBeats?: 1 | 2 };

const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

const narrativeBeatLlmSchema = z.object({
  narration: z.string().min(1),
  dialogues: z.array(transitionDialogueSchema).default([]),
  branchPotential: branchPotentialSchema.default('mid'),
  nextSuggestion: nextStepSuggestionSchema.optional(),
  emotionDrift: z.record(z.string(), z.number()).optional(),
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
  return [
    `时间：${input.timeChange.previous} → ${input.timeChange.current}${input.timeChange.crossedDayBoundary ? '（跨天）' : ''}`,
    `地点：${input.locationChange.fromLocationId ?? '未知'} → ${input.locationChange.toLocationId}`,
    ...(input.flow.beatSummaries.length > 0
      ? [
          `[本事件已发生] ${input.flow.beatSummaries.map((summary, index) => `${index + 1}) ${summary}`).join(' ')}`,
        ]
      : []),
    ...(input.lastChoiceResolution ? [`[上一选择结果] ${input.lastChoiceResolution}`] : []),
    ...(input.flow.pendingTension ? [`[未决张力] ${input.flow.pendingTension}`] : []),
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
      const response = await gateway.generate(buildNarrativeRequest(input, maxBeats, options));
      const parsed = parseStructuredResponse(response.text, narrativeBatchSchema);
      const issues = checkNarrativeConsistency(parsed.beats[0]?.narration ?? '', {
        forbiddenTopics: options.consistency?.forbiddenTopics,
        allowedCharacters: options.consistency?.allowedCharacters,
      });
      if (issues.length > 0) throw new Error(`beat consistency: ${issues.join('; ')}`);
      return parsed.beats.slice(0, maxBeats).map((payload, index) => ({
        beatId: `${input.flow.beatsUsed + index + 1}`.padStart(3, '0'),
        kind: 'narrative',
        narration: payload.narration,
        dialogues: payload.dialogues ?? [],
        source: 'llm',
        branchPotential: payload.branchPotential ?? 'mid',
        nextSuggestion: payload.nextSuggestion,
        emotionDrift: payload.emotionDrift,
      }));
    } catch (error) {
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
          ...buildBaseUserLines(input),
          ...(input.retrievedMemories.length > 0
            ? ['若检索记忆与本拍相关，在文中自然呼应。']
            : ['没有可用检索记忆时，不要虚构记忆引用。']),
          '【职责边界】文段只写：上一选择的余波、时间/地点/环境流动、角色内心与记忆回味、张力铺垫。禁止描写任何玩家可选的具体行动，禁止替玩家做决定。',
          `对话 speakerId 必须使用「${input.npcId ?? input.npcName}」，不要自创角色 ID。`,
          '每个文段拍给出 branchPotential（此处是否值得让玩家做出有分歧的选择）与 nextSuggestion（仅建议）。',
          '严格输出 JSON：',
          '{"beats":[{"narration":"旁白","dialogues":[{"speakerId":"角色ID","text":"台词"}],"branchPotential":"mid","nextSuggestion":"beat","emotionDrift":{"stress":-1}}]}',
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
