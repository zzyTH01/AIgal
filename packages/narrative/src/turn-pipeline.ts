import type { GameState, ModelContext, NPCReaction, Option } from '@ag/schemas';
import { ALWAYS_SUCCESS_RNG, resolveChoice, type RNG, type ResolveChoiceResult } from '@ag/core';
import type { LLMGateway } from '@ag/llm';
import { generateScenario, type ScenarioGeneratorOptions } from './scenario-generator.js';
import { planAndRenderOptions, type LLMOptionPlannerOptions } from './option-planner.js';
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
  scenario?: ScenarioGeneratorOptions;
  options?: LLMOptionPlannerOptions;
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
  const [scenario, planning] = await Promise.all([
    generateScenario(context, gateway, options.scenario),
    planAndRenderOptions(context, gateway, options.options),
  ]);

  const selectedOption = options.selectedOption ?? planning.options[0];
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
  );

  return {
    scenario,
    options: planning.options,
    selectedOption,
    resolution,
    reaction,
  };
}
