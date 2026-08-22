import { type Beat, type EventFlow, type EventImportance } from '@ag/schemas';

/**
 * Beat System 节奏控制器（P0.5，BEAT_SYSTEM_DESIGN.md §2.3）：
 * 下一拍类型由确定性标准裁决——预算/间隔/分支价值；LLM 建议仅为信号。
 */

export interface ImportanceBudget {
  minBeats: number;
  maxBeats: number;
  minChoices: number;
  maxChoices: number;
}

export interface FlowBudgetConfig {
  /** 两个选择点之间至少间隔的文段拍数。 */
  minBeatsBetweenChoices: number;
  /** 文段与选项文本相似度阈值（去重防线③）。 */
  similarityThreshold: number;
  defaults: Record<EventImportance, ImportanceBudget>;
}

export const DEFAULT_FLOW_BUDGET: FlowBudgetConfig = {
  minBeatsBetweenChoices: 2,
  similarityThreshold: 0.6,
  defaults: {
    main: { minBeats: 8, maxBeats: 12, minChoices: 2, maxChoices: 4 },
    side: { minBeats: 5, maxBeats: 6, minChoices: 1, maxChoices: 2 },
    micro: { minBeats: 2, maxBeats: 3, minChoices: 0, maxChoices: 1 },
  },
};

/** 事件重要性 → 数值影响系数（StateResolver 出口统一乘算）。 */
export function importanceImpactScale(importance: EventImportance): number {
  if (importance === 'main') return 1.25;
  if (importance === 'micro') return 0.75;
  return 1;
}

export interface NextStepSignals {
  branchPotential?: 'high' | 'mid' | 'low';
  tensionResolved?: boolean;
}

export type FlowStep = 'narrative' | 'choice' | 'end';

export class FlowController {
  private readonly budget: FlowBudgetConfig;

  constructor(budget: FlowBudgetConfig = DEFAULT_FLOW_BUDGET) {
    this.budget = budget;
  }

  get config(): FlowBudgetConfig {
    return this.budget;
  }

  openFlow(
    eventId: string | null,
    importance: EventImportance,
    rng: () => number = () => 0.5,
  ): EventFlow {
    const range = this.budget.defaults[importance];
    const lerp = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
    return {
      eventId,
      importance,
      beatsUsed: 0,
      maxBeats: lerp(range.minBeats, range.maxBeats),
      choicesUsed: 0,
      maxChoices: Math.min(lerp(range.minChoices, range.maxChoices), range.maxChoices),
      beatsSinceLastChoice: 0,
      status: 'flowing',
      beatSummaries: [],
    };
  }

  /**
   * 裁决下一拍：
   * - end：张力解决 ∨ 拍预算耗尽；
   * - choice：选择预算余量 ∧ 间隔达标 ∧ 分支价值足够（high 达标即可，mid 需多等一拍）；
   * - narrative：其余情况。
   */
  nextStep(flow: EventFlow, signals: NextStepSignals = {}): FlowStep {
    if (signals.tensionResolved || flow.beatsUsed >= flow.maxBeats) return 'end';
    if (flow.choicesUsed >= flow.maxChoices) return 'narrative';

    const gapOk = flow.beatsSinceLastChoice >= this.budget.minBeatsBetweenChoices;
    const potential = signals.branchPotential ?? 'mid';
    const extraWait = potential === 'high' ? 0 : 1;
    const branchOk =
      potential !== 'low' &&
      flow.beatsSinceLastChoice >= this.budget.minBeatsBetweenChoices + extraWait;

    // 收束前最后一个可用拍优先给选择点，保证事件有决策出口。
    const lastUsableBeat = flow.beatsUsed + 1 >= flow.maxBeats;
    if ((gapOk && branchOk) || (gapOk && lastUsableBeat)) return 'choice';
    return 'narrative';
  }

  registerBeat(flow: EventFlow, beat: Beat, summary: string): EventFlow {
    const next: EventFlow = {
      ...flow,
      beatsUsed: flow.beatsUsed + 1,
      beatSummaries: [...flow.beatSummaries, summary],
    };
    if (beat.kind === 'choice') {
      next.choicesUsed = flow.choicesUsed + 1;
      next.beatsSinceLastChoice = 0;
      next.status = 'awaiting-choice';
    } else {
      next.beatsSinceLastChoice = flow.beatsSinceLastChoice + 1;
      next.status = 'flowing';
    }
    return next;
  }
}

/** 中文 bigram 相似度（Jaccard）；与 @ag/memory 的 tokenize 策略一致，但 core 不反向依赖 memory。 */
export function textSimilarity(a: string, b: string): number {
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;
  let intersection = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) intersection += 1;
  }
  return intersection / (gramsA.size + gramsB.size - intersection);
}

function bigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[\s，。！？、；：,.!?;:'"]/g, '');
  const grams = new Set<string>();
  if (normalized.length <= 2) {
    if (normalized.length > 0) grams.add(normalized);
    return grams;
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}
