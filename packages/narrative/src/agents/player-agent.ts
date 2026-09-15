import type { LLMGateway } from '@ag/llm';
import type { ModelContext, Option } from '@ag/schemas';
import {
  generateScenarioAndOptions,
  type CombinedGeneratorOptions,
  type ScenarioOptionsResult,
} from '../combined-generator.js';
import {
  generateChoiceBeat,
  type BeatContextInput,
  type BeatGeneratorOptions,
  type ChoiceBeatResult,
} from '../beat-generator.js';
import {
  auditOutput,
  type AgentCallOptions,
  type AgentValidation,
  type NarrativeAgent,
  type ViewContract,
} from './types.js';

/** 玩家 Agent 视角契约（Master Design §11.11，v1.6）。 */
export const PLAYER_VIEW_CONTRACT: ViewContract = {
  role: 'player',
  jurisdiction: '玩家 Agent（player）：只负责玩家视角的场景叙事与玩家选项。',
  contractText:
    '【Agent 管辖权（player）】你只负责玩家视角的场景叙事与玩家选项：以玩家第一人称「我」描写所见所为（galgame 主人公声音），选项行动主语必须为玩家；禁止描写角色内心活动（只写可观察表现），禁止生成角色的反应或文段拍。',
};

/** 玩家 Agent 门面：场景 + 选项（内部复用 combined / choice-beat 生成器）。 */
export class PlayerAgent implements NarrativeAgent {
  readonly role = 'player' as const;
  readonly viewContract: ViewContract = PLAYER_VIEW_CONTRACT;

  buildSystemRules(baseRules?: string): string {
    const base = baseRules?.trim() || '你是叙事系统：此刻到了玩家可以行动的节点。';
    return `${base}\n${this.viewContract.contractText}`;
  }

  validateOutput(output: unknown): AgentValidation {
    const violations: string[] = [];
    if (output === null || typeof output !== 'object') {
      return { ok: false, violations: ['玩家 Agent 输出不是对象'] };
    }
    const record = output as Record<string, unknown>;
    if ('options' in record) {
      const options = record.options;
      if (!Array.isArray(options) || options.length === 0) {
        violations.push('玩家 Agent 输出缺少选项（options 为空）');
      }
    }
    if ('scenario' in record) {
      const scenario = record.scenario as Record<string, unknown> | undefined;
      if (
        !scenario ||
        typeof scenario.narrative !== 'string' ||
        (scenario.narrative as string).length === 0
      ) {
        violations.push('玩家 Agent 输出缺少场景叙事（scenario.narrative 为空）');
      }
    }
    return { ok: violations.length === 0, violations };
  }

  /** 选择点（引子 + 选项）：注入玩家契约后调用 choice-beat 生成器。 */
  async generateChoiceBeat(
    input: BeatContextInput,
    gateway: LLMGateway,
    options?: BeatGeneratorOptions & AgentCallOptions,
  ): Promise<ChoiceBeatResult> {
    const { onViolation, ...rest } = options ?? {};
    const result = await generateChoiceBeat(
      { ...input, systemRules: this.buildSystemRules(input.systemRules) },
      gateway,
      rest,
    );
    auditOutput(this, result, onViolation);
    return result;
  }

  /** 场景 + 选项（合并调用路径）：注入玩家契约后调用 combined 生成器。 */
  async generateScenarioAndOptions(
    context: ModelContext,
    gateway: LLMGateway,
    options?: CombinedGeneratorOptions & AgentCallOptions,
  ): Promise<ScenarioOptionsResult> {
    const { onViolation, ...rest } = options ?? {};
    const result = await generateScenarioAndOptions(
      { ...context, systemRules: this.buildSystemRules(context.systemRules) },
      gateway,
      rest,
    );
    auditOutput(this, result, onViolation);
    return result;
  }
}

/** 结构类型再导出，便于消费方（runtime）无需直达生成器模块。 */
export type { BeatContextInput, ChoiceBeatResult, ScenarioOptionsResult, Option };
