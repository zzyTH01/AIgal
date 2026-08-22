import { describe, expect, it } from 'vitest';
import { TestProvider } from '@ag/llm';
import {
  fallbackNarrativeBeat,
  generateChoiceBeat,
  generateNarrativeBeats,
  overlapsAny,
  type BeatContextInput,
} from './beat-generator.js';

const baseInput: BeatContextInput = {
  npcName: '阿尔托莉雅',
  npcId: 'char_saber',
  retrievedMemories: [
    {
      id: 'mem_1',
      type: 'episodic',
      content: '玩家在食堂陪伴她用餐。',
      createdAt: { day: 1, time: '09:00' },
      importance: 40,
      emotionalIntensity: 30,
      valence: 15,
      strength: 45,
      accuracy: 90,
      tags: ['care'],
      relatedCharacters: ['char_saber'],
      sourceTurnId: 'run_001/day_001/turn_001',
      retrievalCount: 0,
    },
  ],
  timeChange: { previous: '09:30', current: '10:00', crossedDayBoundary: false },
  locationChange: { fromLocationId: 'loc_canteen', toLocationId: 'loc_canteen' },
  flow: { beatsUsed: 1, choicesUsed: 0, beatSummaries: ['玩家选择了陪伴用餐'] },
  lastChoiceResolution: 'affection +4，气氛缓和。',
};

describe('generateNarrativeBeats', () => {
  it('parses a batch of narrative beats with suggestions', async () => {
    const provider = new TestProvider(() => ({
      text: JSON.stringify({
        beats: [
          {
            narration: '餐具轻碰的声响停了，她望向窗外。',
            dialogues: [{ speakerId: 'char_saber', text: '……雨要来了。' }],
            branchPotential: 'high',
            nextSuggestion: 'choice',
          },
          { narration: '第二拍。', dialogues: [] },
        ],
      }),
    }));
    const beats = await generateNarrativeBeats(baseInput, provider, { maxBeats: 2 });
    expect(beats).toHaveLength(2);
    expect(beats[0]?.branchPotential).toBe('high');
    expect(beats[0]?.dialogues[0]?.speakerId).toBe('char_saber');
    void beats;
    const withMotive = await (async () => {
      const p2 = new TestProvider(() => ({
        text: JSON.stringify({
          beats: [
            {
              narration: '她翻过一页书。',
              dialogues: [],
              branchPotential: 'low',
              motive: '想确认对方是否值得托付信任',
            },
          ],
        }),
      }));
      return (await generateNarrativeBeats(baseInput, p2))[0]!;
    })();
    expect(withMotive.motive).toBe('想确认对方是否值得托付信任');
    expect(provider.calls).toHaveLength(1);
  });

  it('rejects narration repeating recent summaries and falls back', async () => {
    const opening =
      '玩家在食堂陪伴她用餐，两人隔着桌沿轻声交谈，窗外的雨敲打着玻璃，她偶尔抬头望一眼';
    const input = {
      ...baseInput,
      flow: { ...baseInput.flow, beatSummaries: [opening] },
    };
    // 开头 60 字符复写上一拍，后文试图稀释 → 仍应被开头对开头比较拦截
    const provider = TestProvider.fromText(
      JSON.stringify({
        beats: [
          {
            narration: `${opening}。随后她起身离开，走向天台，展开了大量全新的情节与动作描写以稀释全文相似度指标。`,
            dialogues: [],
          },
        ],
      }),
    );
    const beats = await generateNarrativeBeats(input, provider);
    expect(beats[0]?.source).toBe('fallback');
  });

  it('falls back to template when LLM output is invalid', async () => {
    const beats = await generateNarrativeBeats(baseInput, TestProvider.fromText('not-json'));
    expect(beats).toHaveLength(1);
    expect(beats[0]?.source).toBe('fallback');
    expect(beats[0]!.narration).toContain('10:00');
  });

  it('fallback references last choice resolution', () => {
    const beat = fallbackNarrativeBeat(baseInput);
    expect(beat.narration).toContain('刚才的选择');
  });
});

describe('generateChoiceBeat', () => {
  const validOptions = [
    {
      id: 'option_001',
      presentation: { text: '递上一杯热茶', tone: 'gentle' },
      behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.15 },
      gameplay: { progress: 2 },
      effects: {},
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
    },
    {
      id: 'option_002',
      presentation: { text: '安静地看书不打扰', tone: 'calm' },
      behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.05 },
      gameplay: { progress: 0 },
      effects: {},
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
    },
    {
      id: 'option_003',
      presentation: { text: '问她今天过得如何', tone: 'friendly' },
      behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
      gameplay: { progress: 1 },
      effects: {},
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
    },
    {
      id: 'option_004',
      presentation: { text: '直接说出心里的疑惑', tone: 'bold' },
      behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.45 },
      gameplay: { progress: 2 },
      effects: {},
      conditions: {},
      generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
    },
  ];

  it('returns llm choice beat and rejects intro overlapping options via retry→fallback', async () => {
    const overlapping = JSON.stringify({
      intro: '递上一杯热茶给她',
      options: validOptions,
    });
    // 引子与选项一高度重合 → 第一次调用失败 → maxAttempts=0 直接 fallback
    const provider = TestProvider.fromText(overlapping);
    const result = await generateChoiceBeat(baseInput, provider, { maxAttempts: 0 });
    expect(result.source).toBe('fallback');

    // 相似度工具本身可用
    expect(overlapsAny('递上一杯热茶给她', ['递上一杯热茶'])).toBe(true);
    expect(overlapsAny('窗外下起了小雨', ['递上一杯热茶'])).toBe(false);
  });

  it('accepts non-overlapping intro as llm choice beat', async () => {
    const payload = JSON.stringify({
      intro: '雨声渐起，是时候做点什么了。',
      options: validOptions,
    });
    const result = await generateChoiceBeat(baseInput, TestProvider.fromText(payload));
    expect(result.source).toBe('llm');
    expect(result.options).toHaveLength(4);
    expect(result.intro).toContain('雨声');
  });

  it('fallback choice beat uses deterministic diverse options', async () => {
    const result = await generateChoiceBeat(
      baseInput,
      new TestProvider(() => {
        throw new Error('down');
      }),
      { maxAttempts: 0 },
    );
    expect(result.source).toBe('fallback');
    expect(result.options.length).toBeGreaterThanOrEqual(4);
  });
});
