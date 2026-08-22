import {
  transitionLlmSchema,
  type MemoryCandidate,
  type MemoryRecord,
  type TransitionDialogue,
} from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { parseStructuredResponse } from './structured-parser.js';
import { checkNarrativeConsistency } from './consistency-check.js';

export interface TransitionContextInput {
  npcName: string;
  /** 复用 Context 组装的 system rules；缺省用通用旁白指令。 */
  systemRules?: string;
  /** 内容承接：上一轮选择与反应摘要（禁止无因果空降过渡）。 */
  lastTurn?: {
    optionActions: string[];
    reactionSummary: string;
    newMemoryContents: string[];
  };
  /** Memory 联动①：检索素材，referencedMemoryIds 只能引用其中的 id。 */
  retrievedMemories: MemoryRecord[];
  timeChange: { previous: string; current: string; crossedDayBoundary: boolean };
  locationChange: { fromLocationId: string | null; toLocationId: string };
  environmentChanges?: Record<string, string | number>;
}

export interface TransitionGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
  consistency?: {
    forbiddenTopics?: string[];
    allowedCharacters?: string[];
  };
}

export interface TransitionNarrativeResult {
  narration: string;
  dialogues: TransitionDialogue[];
  /** 已按检索集白名单过滤后的引用记忆。 */
  referencedMemoryIds: string[];
  memoryCandidate?: MemoryCandidate;
  source: 'llm' | 'fallback';
}

/**
 * P0 过渡文段生成（独立路径；默认走 combined 合并路径）：
 * 旁白描写时间/地点/环境流逝，对话表现角色余波情绪；
 * 引用检索记忆形成"回味"，并可产出新的 memoryCandidate。
 */
export async function generateTransition(
  input: TransitionContextInput,
  gateway: LLMGateway,
  options: TransitionGeneratorOptions = {},
): Promise<TransitionNarrativeResult> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildTransitionRequest(input, options));
      const parsed = parseStructuredResponse(response.text, transitionLlmSchema);
      const issues = checkNarrativeConsistency(parsed.narration, {
        forbiddenTopics: options.consistency?.forbiddenTopics,
        allowedCharacters: options.consistency?.allowedCharacters,
      });
      if (issues.length > 0) throw new Error(`transition consistency: ${issues.join('; ')}`);
      return finalize(
        input,
        { ...parsed, referencedMemoryIds: parsed.referencedMemoryIds ?? [] },
        'llm',
      );
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
    }
  }
  return fallbackTransition(input);
}

/** 引擎校验：referencedMemoryIds 必须是输入检索集的子集。 */
export function finalizeTransitionPayload(
  input: TransitionContextInput,
  payload: Pick<TransitionNarrativeResult, 'narration' | 'dialogues' | 'memoryCandidate'> & {
    referencedMemoryIds: string[];
  },
  source: 'llm' | 'fallback',
): TransitionNarrativeResult {
  return finalize(input, payload, source);
}

function finalize(
  input: TransitionContextInput,
  payload: {
    narration: string;
    dialogues: TransitionDialogue[];
    referencedMemoryIds: string[];
    memoryCandidate?: MemoryCandidate;
  },
  source: 'llm' | 'fallback',
): TransitionNarrativeResult {
  const retrievable = new Set(input.retrievedMemories.map((record) => record.id));
  return {
    narration: payload.narration,
    dialogues: payload.dialogues,
    referencedMemoryIds: payload.referencedMemoryIds.filter((id) => retrievable.has(id)),
    memoryCandidate: payload.memoryCandidate,
    source,
  };
}

export function fallbackTransition(input: TransitionContextInput): TransitionNarrativeResult {
  const envText = Object.entries(input.environmentChanges ?? {})
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('，');
  const locationText =
    input.locationChange.fromLocationId &&
    input.locationChange.fromLocationId !== input.locationChange.toLocationId
      ? `${input.locationChange.fromLocationId} 来到 ${input.locationChange.toLocationId}`
      : `仍在 ${input.locationChange.toLocationId}`;
  const dayText = input.timeChange.crossedDayBoundary ? '新的一天开始了。' : '';
  const afterthought = input.lastTurn ? '刚才的事还留在心头。' : '';

  return finalizeTransitionPayload(
    input,
    {
      narration: `（${input.timeChange.current}，${locationText}${envText ? `，${envText}` : ''}）${dayText}${afterthought}`,
      dialogues: [],
      referencedMemoryIds: [],
    },
    'fallback',
  );
}

function buildTransitionRequest(
  input: TransitionContextInput,
  options: TransitionGeneratorOptions,
): LLMRequest {
  const memoryLines = input.retrievedMemories.map(
    (memory, index) => `[检索记忆${index + 1}] id=${memory.id} ${memory.content}`,
  );
  const lastTurnLines = input.lastTurn
    ? [
        `[上一轮] 玩家行为：${input.lastTurn.optionActions.join('/')}`,
        `角色反应：${input.lastTurn.reactionSummary}`,
        ...input.lastTurn.newMemoryContents.map((content) => `新记忆：${content}`),
      ]
    : ['[上一轮] 本局开始，无前序轮次。'];
  const changeLines = [
    `时间：${input.timeChange.previous} → ${input.timeChange.current}${input.timeChange.crossedDayBoundary ? '（跨天）' : ''}`,
    `地点：${input.locationChange.fromLocationId ?? '未知'} → ${input.locationChange.toLocationId}`,
    ...(input.environmentChanges && Object.keys(input.environmentChanges).length > 0
      ? [
          `环境：${Object.entries(input.environmentChanges)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join('，')}`,
        ]
      : []),
  ];

  return {
    model: options.model,
    temperature: 0.7,
    maxTokens: 512,
    messages: [
      {
        role: 'system',
        content:
          input.systemRules ??
          '你是叙事旁白系统：输出场景之间的过渡文段，保持世界连续性与角色一致性。',
      },
      {
        role: 'user',
        content: [
          `【任务】为「${input.npcName}」生成两段场景之间的过渡文段（过场）。`,
          ...changeLines,
          ...lastTurnLines,
          ...memoryLines,
          ...(memoryLines.length > 0
            ? [
                '若某条检索记忆与本过渡相关，在文段中自然呼应"回味"，并用 referencedMemoryIds 标注其 id。',
              ]
            : ['没有可用的检索记忆时，不要虚构记忆引用。']),
          '旁白描写环境与时间流逝；对话表现角色的余波情绪（可为空数组）。',
          '严格输出 JSON：',
          '{"narration":"旁白文段","dialogues":[{"speakerId":"char_xxx","text":"台词"}],"referencedMemoryIds":["mem_xxx"],"memoryCandidate":{"type":"episodic","content":"回想内容","importance":30,"emotionalIntensity":25,"valence":10,"tags":["care"],"relatedCharacters":["char_xxx"],"sourceTurnId":"当前 turnId"}}',
        ].join('\n'),
      },
    ],
  };
}
