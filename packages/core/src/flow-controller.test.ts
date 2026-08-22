import { describe, expect, it } from 'vitest';
import { beatSchema, type Beat } from '@ag/schemas';
import {
  DEFAULT_FLOW_BUDGET,
  FlowController,
  importanceImpactScale,
  textSimilarity,
} from './flow-controller.js';

const controller = new FlowController();

function narrativeBeat(beatId: string): Beat {
  return beatSchema.parse({
    beatId,
    kind: 'narrative',
    narration: '文段',
    dialogues: [],
    source: 'fallback',
  });
}

function choiceBeat(beatId: string): Beat {
  return {
    beatId,
    kind: 'choice',
    options: [],
    source: 'llm',
  } as unknown as Beat;
}

describe('FlowController', () => {
  it('opens flows with importance-based budgets', () => {
    const main = controller.openFlow('event_a', 'main');
    const micro = controller.openFlow('event_b', 'micro');
    expect(main.maxBeats).toBeGreaterThanOrEqual(DEFAULT_FLOW_BUDGET.defaults.main.minBeats);
    expect(main.maxBeats).toBeLessThanOrEqual(DEFAULT_FLOW_BUDGET.defaults.main.maxBeats);
    expect(micro.maxChoices).toBeLessThanOrEqual(1);
    expect(importanceImpactScale('main')).toBe(1.25);
    expect(importanceImpactScale('micro')).toBe(0.75);
    expect(importanceImpactScale('side')).toBe(1);
  });

  it('requires a minimum gap of narrative beats before a choice point', () => {
    let flow = controller.openFlow('event_a', 'side');
    // 开场即建议 high：间隔不足仍应先出文段
    expect(controller.nextStep(flow, { branchPotential: 'high' })).toBe('narrative');

    flow = controller.registerBeat(flow, narrativeBeat('b1'), '第一拍');
    flow = controller.registerBeat(flow, narrativeBeat('b2'), '第二拍');
    // 两拍之后 + high 建议 → 选择点
    expect(controller.nextStep(flow, { branchPotential: 'high' })).toBe('choice');
  });

  it('mid potential needs one extra beat of wait; low never triggers choice', () => {
    let flow = controller.openFlow('event_a', 'side');
    for (let i = 0; i < 2; i += 1)
      flow = controller.registerBeat(flow, narrativeBeat(`b${i}`), `s${i}`);
    expect(controller.nextStep(flow, { branchPotential: 'mid' })).toBe('narrative');

    flow = controller.registerBeat(flow, narrativeBeat('b3'), '第三拍');
    expect(controller.nextStep(flow, { branchPotential: 'mid' })).toBe('choice');
    expect(controller.nextStep(flow, { branchPotential: 'low' })).toBe('narrative');
  });

  it('respects maxChoices and forces end when beat budget is exhausted', () => {
    const budget: typeof DEFAULT_FLOW_BUDGET = {
      ...DEFAULT_FLOW_BUDGET,
      defaults: {
        ...DEFAULT_FLOW_BUDGET.defaults,
        micro: { minBeats: 2, maxBeats: 3, minChoices: 0, maxChoices: 0 },
      },
    };
    const c = new FlowController(budget);
    let flow = c.openFlow('e', 'micro', () => 0);
    while (flow.beatsUsed < flow.maxBeats) {
      flow = c.registerBeat(flow, narrativeBeat(`b${flow.beatsUsed}`), 's');
    }
    expect(c.nextStep(flow)).toBe('end');

    let side = controller.openFlow('e2', 'side');
    side = controller.registerBeat(side, choiceBeat('c1'), '选择');
    side = controller.registerBeat(side, narrativeBeat('n1'), 's1');
    side = controller.registerBeat(side, narrativeBeat('n2'), 's2');
    // side maxChoices=2，还剩一次；此时 high → choice
    expect(controller.nextStep(side, { branchPotential: 'high' })).toBe('choice');
  });

  it('tension resolution ends the flow immediately', () => {
    const flow = controller.openFlow('e', 'main');
    expect(controller.nextStep(flow, { tensionResolved: true })).toBe('end');
  });

  it('computes chinese bigram similarity for dedup', () => {
    expect(textSimilarity('帮她把书搬回图书馆', '帮她把书搬回图书馆')).toBeGreaterThan(0.9);
    expect(textSimilarity('帮她把书搬回图书馆', '在雨里等公交车回家')).toBeLessThan(0.15);
  });
});
