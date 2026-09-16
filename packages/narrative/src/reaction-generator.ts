import {
  npcReactionSchema,
  type GameState,
  type ModelContext,
  type NPCReaction,
  type Option,
} from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import type { FinalStateDelta } from '@ag/schemas';
import { parseStructuredResponse } from './structured-parser.js';
import { checkNarrativeConsistency } from './consistency-check.js';

export interface ReactionGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
  consistency?: {
    forbiddenTopics?: string[];
    allowedCharacters?: string[];
  };
  /**
   * #16 观察a：当前场景 grounding——反应必须发生在该日/时/地点，
   * 不得跳转到事件模板或其他场景（真实复验 1/12 轮出现走廊→食堂跳变）。
   */
  scene?: {
    day?: number;
    time?: string;
    locationId?: string;
    /** 最近一拍的旁白摘要（≤60 字符）。 */
    lastBeatSummary?: string;
  };
}

/**
 * 10 NPC Reaction：玩家选择后生成双通道反应。
 * Natural Language 给玩家，Structured 交给引擎校验；StateResolver 仍掌握最终数值。
 */
export async function generateReaction(
  context: ModelContext,
  state: GameState,
  selectedOption: Option,
  gateway: LLMGateway,
  options: ReactionGeneratorOptions = {},
  resolution?: { directDelta: FinalStateDelta },
): Promise<NPCReaction & { source: 'llm' | 'fallback' }> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(
        buildReactionRequest(context, selectedOption, options, resolution),
      );
      const reaction = parseStructuredResponse(response.text, npcReactionSchema);
      const issues = checkNarrativeConsistency(reaction.narrative, {
        forbiddenTopics: options.consistency?.forbiddenTopics,
        allowedCharacters: options.consistency?.allowedCharacters,
      });
      if (issues.length > 0) throw new Error(`reaction consistency: ${issues.join('; ')}`);
      return { ...reaction, source: 'llm' };
    } catch (error) {
      if (error instanceof LLMError && !error.retryable) break;
      // Retry; final fallback below.
    }
  }

  return { ...fallbackReaction(state), source: 'fallback' };
}

function buildReactionRequest(
  context: ModelContext,
  selectedOption: Option,
  options: ReactionGeneratorOptions,
  resolution?: { directDelta: FinalStateDelta },
): LLMRequest {
  const resolutionSummary = summarizeResolution(resolution);
  const npcName = Object.values(context.currentState.characters)[0]?.identity.name ?? '当前角色';
  const memoryLines = context.retrievedMemories.map(
    (memory, index) => `[检索记忆${index + 1}] ${memory.content}（重要度 ${memory.importance}）`,
  );
  const eventLines = [
    ...(context.currentEvent
      ? options.scene
        ? // #16 观察a：提供 scene 时事件只保留标题——描述中的地点/时间锚定力过强，
          // 会把反应拉回事件模板场景（实测走廊拍→食堂反应），时空以 [当前场景] 为准。
          [`[当前事件] ${context.currentEvent.title}（进行中，地点/时间以 [当前场景] 为准）`]
        : [`[当前事件] ${context.currentEvent.title}：${context.currentEvent.description}`]
      : []),
    ...context.recentEvents.map((event) => `[近期事件] ${event.title}：${event.description}`),
  ];

  return {
    model: options.model,
    temperature: 0.7,
    maxTokens: 768,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `【角色定位】你现在扮演「${npcName}」，回应玩家。不要替玩家说话，也不要描写玩家未选择的行动。反应的旁白/舞台指示以玩家第一人称「我」的视角描写「${npcName}」的可观察反应，不要描写「我」的心理活动。`,
          ...(options.scene
            ? [
                `[当前场景] Day ${options.scene.day ?? '?'} ${options.scene.time ?? '?'} @ ${options.scene.locationId ?? '?'}${options.scene.lastBeatSummary ? `；最近一拍：${options.scene.lastBeatSummary}` : ''}。反应必须发生在该场景，延续最近一拍的时空，不得跳转到其他地点或时间；若 [当前事件] 的场景与本行冲突，以本行为准。`,
              ]
            : []),
          `玩家选择了行为：${selectedOption.behavior.actions.join('/')}（意图：${selectedOption.behavior.intent.join('/')}）。`,
          ...eventLines,
          ...memoryLines,
          ...(memoryLines.length > 0
            ? ['如果检索记忆与本轮相关，请在言行中自然呼应，但不要逐字背诵。']
            : []),
          ...(resolutionSummary ? [`结算结果：${resolutionSummary}`] : []),
          '请依据结算结果生成 NPC 反应。如果本轮有值得角色记住的事，请在 memoryCandidates 给出候选（没有则为空数组）。',
          '严格输出 JSON：',
          '{"narrative":"NPC台词/反应","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0},"memoryCandidates":[{"type":"episodic","content":"玩家做了什么/角色感受","importance":40,"emotionalIntensity":25,"valence":10,"tags":["help"],"relatedCharacters":["char_mio"],"sourceTurnId":"当前 turnId"}]}}',
        ].join('\n'),
      },
    ],
  };
}

function summarizeResolution(resolution?: { directDelta: FinalStateDelta }): string | undefined {
  if (!resolution) return undefined;
  const entries = Object.entries(resolution.directDelta.relationships ?? {}).flatMap(
    ([relationshipId, metrics]) =>
      Object.entries(metrics).map(
        ([metric, change]) =>
          `${relationshipId}.${metric}: ${change.before}→${change.after} (${change.delta >= 0 ? '+' : ''}${change.delta})`,
      ),
  );
  return entries.length > 0 ? entries.join('；') : undefined;
}

function fallbackReaction(state: GameState): NPCReaction {
  const character = Object.values(state.characters)[0];
  return {
    narrative: '……（NPC 没有回应。）',
    structured: character
      ? { emotion: { type: character.emotion.primary, intensity: character.emotion.intensity } }
      : {},
  };
}
