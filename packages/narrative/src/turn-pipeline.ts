import type { GameState, ModelContext, NPCReaction, Option } from '@ag/schemas';
import { ALWAYS_SUCCESS_RNG, resolveChoice, type RNG, type ResolveChoiceResult } from '@ag/core';
import type { LLMGateway } from '@ag/llm';
import { generateScenarioAndOptions, type CombinedGeneratorOptions } from './combined-generator.js';
import { generateReaction, type ReactionGeneratorOptions } from './reaction-generator.js';
import type { GeneratedScenario } from './scenario.js';

export interface NarrativeTurnResult {
  scenario: GeneratedScenario & { source: 'llm' | 'fallback' };
  options: Option[];
  selectedOption: Option;
  resolution: ResolveChoiceResult;
  reaction: NPCReaction & { source: 'llm' | 'fallback' };
}

export interface NarrativeTurnOptions {
  selectedOption?: Option;
  rng?: RNG;
  combined?: CombinedGeneratorOptions;
  reaction?: ReactionGeneratorOptions;
}

/**
 * Phase 5 完整链路：Scenario → Options → Player Choice → StateResolver → NPC Reaction。
 * 本函数不改写输入 GameState；只有 StateResolver 输出最终 delta。
 */
export async function runNarrativeTurn(
  context: ModelContext,
  state: GameState,
  gateway: LLMGateway,
  options: NarrativeTurnOptions = {},
): Promise<NarrativeTurnResult> {
  // Phase 7：Scenario + Options 已合并为 1 次 LLM 调用；Turn = 2 次调用。
  const generated = await generateScenarioAndOptions(context, gateway, options.combined);

  const selectedOption = options.selectedOption ?? generated.options[0];
  if (!selectedOption) {
    throw new Error('Narrative turn requires at least one Option');
  }

  const rng = options.rng ?? ALWAYS_SUCCESS_RNG;
  const resolution = resolveChoice(state, selectedOption, rng);
  const reaction = await generateReaction(
    context,
    state,
    selectedOption,
    gateway,
    options.reaction,
    resolution,
  );

  return {
    scenario: { ...generated.scenario, source: generated.source },
    options: generated.options,
    selectedOption,
    resolution,
    reaction,
  };
}
