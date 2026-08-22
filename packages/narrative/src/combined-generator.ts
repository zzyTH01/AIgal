import { z } from 'zod';
import { transitionLlmSchema, type ModelContext } from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import { planDiverseOptions, renderOptions, validateOptions, type PlannedOption } from '@ag/option';
import { generatedScenarioSchema, type GeneratedScenario } from './scenario.js';
import { plannedOptionSchema } from './option-planner.js';
import { parseStructuredResponse } from './structured-parser.js';
import { checkNarrativeConsistency } from './consistency-check.js';
import {
  fallbackTransition,
  finalizeTransitionPayload,
  type TransitionContextInput,
  type TransitionNarrativeResult,
} from './transition-generator.js';
import { fallbackScenario } from './scenario-generator.js';

export const combinedGenerationSchema = z
  .object({
    transition: transitionLlmSchema.optional(),
    scenario: generatedScenarioSchema,
    options: z.array(plannedOptionSchema).min(1),
  })
  .strict();

export interface CombinedGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
  minOptions?: number;
  consistency?: {
    forbiddenTopics?: string[];
    allowedCharacters?: string[];
  };
  /** P0：提供则在同一次调用中先生成过场文段（LLM Call Minimization）。 */
  transition?: TransitionContextInput;
}

export interface ScenarioOptionsResult {
  scenario: GeneratedScenario;
  options: Awaited<ReturnType<typeof renderOptions>>;
  source: 'llm' | 'fallback';
  transition?: TransitionNarrativeResult;
}

/**
 * LLM Call Minimization：Scenario + Options 合并为 1 次调用。
 * Phase 7 起 `runNarrativeTurn` 使用本函数，Turn 从 3 次降为 2 次。
 */
export async function generateScenarioAndOptions(
  context: ModelContext,
  gateway: LLMGateway,
  options: CombinedGeneratorOptions = {},
): Promise<ScenarioOptionsResult> {
  const maxAttempts = options.maxAttempts ?? 1;
  const minOptions = options.minOptions ?? 4;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(buildCombinedRequest(context, options));
      const parsed = parseStructuredResponse(response.text, combinedGenerationSchema);
      const issues = checkNarrativeConsistency(parsed.scenario.narrative, {
        forbiddenTopics: options.consistency?.forbiddenTopics,
        allowedCharacters: options.consistency?.allowedCharacters,
      });
      if (issues.length > 0) throw new Error(`scenario consistency: ${issues.join('; ')}`);
      const rendered = renderOptions(parsed.options);
      if (
        rendered.length >= minOptions &&
        validateOptions(rendered, {
          gameState: context.currentState,
          diversityMode: 'soft',
        }).valid
      ) {
        return {
          scenario: parsed.scenario,
          options: rendered,
          source: 'llm',
          transition: resolveTransitionPayload(options.transition, parsed.transition, 'llm'),
        };
      }
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
    }
  }

  const fallbackPlans: PlannedOption[] = planDiverseOptions(Math.max(minOptions, 4));
  return {
    scenario: fallbackScenario(context),
    options: renderOptions(fallbackPlans),
    source: 'fallback',
    transition: resolveTransitionPayload(options.transition, undefined, 'fallback'),
  };
}

/** LLM 缺失 transition 段时降级为模板，不使整份调用失败。 */
function resolveTransitionPayload(
  input: TransitionContextInput | undefined,
  payload:
    | {
        narration: string;
        dialogues: { speakerId: string; text: string }[];
        referencedMemoryIds?: string[];
        memoryCandidate?: TransitionNarrativeResult['memoryCandidate'];
      }
    | undefined,
  source: 'llm' | 'fallback',
): TransitionNarrativeResult | undefined {
  if (!input) return undefined;
  if (payload && source === 'llm') {
    return finalizeTransitionPayload(
      input,
      { ...payload, referencedMemoryIds: payload.referencedMemoryIds ?? [] },
      'llm',
    );
  }
  return fallbackTransition(input);
}

function buildCombinedRequest(
  context: ModelContext,
  options: CombinedGeneratorOptions,
): LLMRequest {
  const npcName = Object.values(context.currentState.characters)[0]?.identity.name ?? '当前角色';
  const memoryLines = context.retrievedMemories.map(
    (memory, index) => `[检索记忆${index + 1}] id=${memory.id} ${memory.content}`,
  );
  const eventLines = [
    ...(context.currentEvent
      ? [`[当前事件] ${context.currentEvent.title}：${context.currentEvent.description}`]
      : []),
    ...context.recentEvents.map((event) => `[近期事件] ${event.title}：${event.description}`),
  ];
  const transitionInput = options.transition;
  const transitionLines = transitionInput
    ? [
        '[过场要求] 在 scenario 与 options 之前，先输出 transition 段：旁白+对话的过渡文段，衔接上一轮与本场景。',
        `时间：${transitionInput.timeChange.previous} → ${transitionInput.timeChange.current}${transitionInput.timeChange.crossedDayBoundary ? '（跨天）' : ''}`,
        `地点：${transitionInput.locationChange.fromLocationId ?? '未知'} → ${transitionInput.locationChange.toLocationId}`,
        `对话 speakerId 必须使用「${transitionInput.npcId ?? transitionInput.npcName}」，不要自创角色 ID。`,
        ...(transitionInput.lastTurn
          ? [
              `上一轮：玩家行为 ${transitionInput.lastTurn.optionActions.join('/')}；角色反应：${transitionInput.lastTurn.reactionSummary}`,
            ]
          : []),
        ...(transitionInput.retrievedMemories.length > 0
          ? [
              ...transitionInput.retrievedMemories.map(
                (memory, index) => `[过场检索记忆${index + 1}] id=${memory.id} ${memory.content}`,
              ),
              '若某条过场检索记忆相关，在 transition 中自然"回味"并用 referencedMemoryIds 标注其 id。',
            ]
          : ['没有可用检索记忆时，transition 不要虚构记忆引用。']),
      ]
    : [];

  return {
    model: options.model,
    temperature: 0.8,
    maxTokens: 1536,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `【角色定位】你是玩家，正在与「${npcName}」互动。场景用第二人称描写玩家眼前所见；所有选项必须是玩家对「${npcName}」采取的行动，不要写 NPC 对玩家或第三方的行动。`,
          `Day ${context.day} ${context.time}，生成当前场景和 4 个行为选项。`,
          ...transitionLines,
          ...eventLines,
          ...memoryLines,
          ...(memoryLines.length > 0
            ? ['如果上述检索记忆与本轮相关，请在场景或选项文本中自然呼应。']
            : []),
          '必须覆盖：主动 / 保守 / 社交关系 / 风险。',
          'conditions 只允许 {} 或 {"<flag>": boolean|number|"字符串"}；不要输出数组/null/嵌套对象。',
          '严格输出 JSON：',
          transitionInput
            ? '{"transition":{"narration":"过场旁白","dialogues":[{"speakerId":"char_xxx","text":"余波台词"}],"referencedMemoryIds":["mem_xxx"]},"scenario":{"narrative":"场景文本","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0}}},"options":[{"id":"option_001","presentation":{"text":"自然语言选项","tone":"..."},"behavior":{"actions":["support"],"intent":["care"],"risk":0.15},"gameplay":{"progress":2},"effects":{"affection":{"base":2}},"conditions":{},"generation":{"must_fit_character":true,"must_fit_context":true,"variation":"high"}}]}'
            : '{"scenario":{"narrative":"场景文本","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0}}},"options":[{"id":"option_001","presentation":{"text":"自然语言选项","tone":"..."},"behavior":{"actions":["support"],"intent":["care"],"risk":0.15},"gameplay":{"progress":2},"effects":{"affection":{"base":2}},"conditions":{},"generation":{"must_fit_character":true,"must_fit_context":true,"variation":"high"}}]}',
        ].join('\n'),
      },
    ],
  };
}
