import type { LLMGateway } from '@ag/llm';
import type { GameState, ModelContext, NarrativeBeat, Option } from '@ag/schemas';
import {
  generateNarrativeBeats,
  type BeatContextInput,
  type BeatGeneratorOptions,
} from '../beat-generator.js';
import { generateReaction, type ReactionGeneratorOptions } from '../reaction-generator.js';
import {
  generateTransition,
  type TransitionContextInput,
  type TransitionGeneratorOptions,
  type TransitionNarrativeResult,
} from '../transition-generator.js';
import {
  auditOutput,
  type AgentCallOptions,
  type AgentValidation,
  type NarrativeAgent,
  type ViewContract,
} from './types.js';

/** 角色 Agent 视角契约（Master Design §11.11，v1.6）。 */
export const CHARACTER_VIEW_CONTRACT: ViewContract = {
  role: 'character',
  jurisdiction: '角色 Agent（character）：只负责角色的可观察言行（文段拍/反应/过渡）。',
  contractText:
    '【Agent 管辖权（character）】你只负责角色的可观察言行：旁白以玩家第一人称「我」的视角叙述（galgame 主人公声音），写「我」的所见所感、环境流动与角色的可观察言行；角色内心只允许进入 motive 字段（引擎留存，不呈现给玩家）；禁止描写玩家未做出的任何新行动，禁止替代玩家决策。',
};

/** 角色 Agent 门面：文段拍 + 反应 + 过渡（内部复用对应生成器）。 */
export class CharacterAgent implements NarrativeAgent {
  readonly role = 'character' as const;
  readonly viewContract: ViewContract = CHARACTER_VIEW_CONTRACT;

  buildSystemRules(baseRules?: string): string {
    const base =
      baseRules?.trim() ||
      '你是叙事旁白系统：输出事件内连续叙事流的文段拍，保持世界连续性与角色一致性。';
    return `${base}\n${this.viewContract.contractText}`;
  }

  validateOutput(output: unknown): AgentValidation {
    const violations: string[] = [];
    if (Array.isArray(output)) {
      // 文段拍数组：每拍必须有 narration，且不得含 options 字段（结构上禁止预支选项）。
      for (const [index, beat] of output.entries()) {
        if (beat === null || typeof beat !== 'object') {
          violations.push(`文段拍 ${index} 不是对象`);
          continue;
        }
        const record = beat as Record<string, unknown>;
        if (typeof record.narration !== 'string' || record.narration.length === 0) {
          violations.push(`文段拍 ${index} 缺少 narration`);
        }
        if ('options' in record) {
          violations.push(`文段拍 ${index} 含 options 字段（结构上禁止预支选项）`);
        }
      }
      return { ok: violations.length === 0, violations };
    }
    if (output === null || typeof output !== 'object') {
      return { ok: false, violations: ['角色 Agent 输出不是对象或数组'] };
    }
    const record = output as Record<string, unknown>;
    // 反应/过渡：narrative 或 narration 必须为非空文本。
    if ('narrative' in record) {
      const narrative = record.narrative;
      if (typeof narrative !== 'string' || narrative.length === 0) {
        violations.push('角色反应缺少 narrative 文本');
      }
    }
    if ('narration' in record) {
      const narration = record.narration;
      if (typeof narration !== 'string' || narration.length === 0) {
        violations.push('过渡缺少 narration 文本');
      }
    }
    return { ok: violations.length === 0, violations };
  }

  /** 文段拍：注入角色契约后调用 beat 生成器。 */
  async generateNarrativeBeats(
    input: BeatContextInput,
    gateway: LLMGateway,
    options?: BeatGeneratorOptions & AgentCallOptions,
  ): Promise<NarrativeBeat[]> {
    const { onViolation, ...rest } = options ?? {};
    const beats = await generateNarrativeBeats(
      { ...input, systemRules: this.buildSystemRules(input.systemRules) },
      gateway,
      rest,
    );
    auditOutput(this, beats, onViolation);
    return beats;
  }

  /** 角色反应：注入角色契约后调用 reaction 生成器。 */
  async generateReaction(
    context: ModelContext,
    state: GameState,
    option: Option,
    gateway: LLMGateway,
    options?: ReactionGeneratorOptions & AgentCallOptions,
    resolution?: Parameters<typeof generateReaction>[5],
  ): Promise<Awaited<ReturnType<typeof generateReaction>>> {
    const { onViolation, ...rest } = options ?? {};
    const result = await generateReaction(
      { ...context, systemRules: this.buildSystemRules(context.systemRules) },
      state,
      option,
      gateway,
      rest,
      resolution,
    );
    auditOutput(this, result, onViolation);
    return result;
  }

  /** 过渡文段：注入角色契约后调用 transition 生成器。 */
  async generateTransition(
    input: TransitionContextInput,
    gateway: LLMGateway,
    options?: TransitionGeneratorOptions & AgentCallOptions,
  ): Promise<TransitionNarrativeResult> {
    const { onViolation, ...rest } = options ?? {};
    const result = await generateTransition(
      { ...input, systemRules: this.buildSystemRules(input.systemRules) },
      gateway,
      rest,
    );
    auditOutput(this, result, onViolation);
    return result;
  }
}
