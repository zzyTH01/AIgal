import {
  npcReactionSchema,
  type GameState,
  type ModelContext,
  type NPCReaction,
  type Option,
} from '@ag/schemas';
import type { LLMGateway, LLMRequest } from '@ag/llm';
import { parseStructuredResponse } from './structured-parser.js';

export interface ReactionGeneratorOptions {
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
): Promise<NPCReaction & { source: 'llm' | 'fallback' }> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await gateway.generate(
        buildReactionRequest(context, selectedOption, options),
      );
      return { ...parseStructuredResponse(response.text, npcReactionSchema), source: 'llm' };
    } catch {
      // Retry; final fallback below.
    }
  }

  return { ...fallbackReaction(state), source: 'fallback' };
}

function buildReactionRequest(
  context: ModelContext,
  selectedOption: Option,
  options: ReactionGeneratorOptions,
): LLMRequest {
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
          '请生成 NPC 反应，严格输出 JSON：',
          '{"narrative":"NPC台词/反应","structured":{"emotion":{"type":"...","intensity":0},"intent":{"type":"...","intensity":0},"memoryCandidates":[]}}',
        ].join('\n'),
      },
    ],
  };
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
