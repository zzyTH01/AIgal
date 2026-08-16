import {
  npcReactionSchema,
  type GameState,
  type ModelContext,
  type NPCReaction,
  type Option,
} from '@ag/schemas';
import { LLMError, type LLMGateway, type LLMRequest } from '@ag/llm';
import type { ResolveChoiceResult } from '@ag/core';
import { parseStructuredResponse } from './structured-parser.js';

export interface ReactionGeneratorOptions {
  /** 最多重试次数；实际总调用次数为 maxAttempts + 1。 */
  maxAttempts?: number;
  model?: string;
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
  resolution?: ResolveChoiceResult,
): Promise<NPCReaction & { source: 'llm' | 'fallback' }> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(
        buildReactionRequest(context, selectedOption, options, resolution),
      );
      return { ...parseStructuredResponse(response.text, npcReactionSchema), source: 'llm' };
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
  resolution?: ResolveChoiceResult,
): LLMRequest {
  const resolutionSummary = summarizeResolution(resolution);
  return {
    model: options.model,
    temperature: 0.7,
    maxTokens: 512,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `玩家选择了行为：${selectedOption.behavior.actions.join('/')}（意图：${selectedOption.behavior.intent.join('/')}）。`,
          ...(resolutionSummary ? [`结算结果：${resolutionSummary}`] : []),
          '请依据结算结果生成 NPC 反应，严格输出 JSON：',
          '{"narrative":"NPC台词/反应","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0},"memoryCandidates":[]}}',
        ].join('\n'),
      },
    ],
  };
}

function summarizeResolution(resolution?: ResolveChoiceResult): string | undefined {
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
