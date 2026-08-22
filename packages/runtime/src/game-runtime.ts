import {
  type Beat,
  type CharacterDefinition,
  type ChoiceBeat,
  type EndingDefinition,
  type EventDefinition,
  type EventFlow,
  type GameState,
  type ModelContext,
  type Option,
  type FinalStateDelta,
  type ProjectPolicy,
  type TurnResult,
} from '@ag/schemas';
import {
  applyBadEndPunishment,
  applyDelta,
  cloneGameState,
  applyMetaProgression,
  createGameState,
  defaultRelationship,
  definitionToGameCharacter,
  FlowController,
  DEFAULT_FLOW_BUDGET,
  importanceImpactScale,
  resolveSecondaryDelta,
  startTurn as startTurnTransaction,
  updatePlayerModelFromTurn,
  type FlowBudgetConfig,
  type RNG,
} from '@ag/core';
import { EventPool, XorShift128Rng, commitTriggeredEvent } from '@ag/world';
import { MemorySaveRepository, type SaveRepository } from '@ag/persistence';
import { buildContext, ContextCache, type ContextCacheStats } from '@ag/context';
import { formMemory, consolidateMemories, reinforceMemoryRecord, pruneMemories } from '@ag/memory';
import {
  generateReaction,
  generateNarrativeBeats,
  generateChoiceBeat,
  type BeatContextInput,
  type CombinedGeneratorOptions,
} from '@ag/narrative';
import {
  createGateway,
  loadProviderConfigFromEnv,
  TestProvider,
  type LLMGateway,
  type LLMProviderConfig,
} from '@ag/llm';
import { demoCharacter, demoEvents } from './demo-project.js';

export interface RuntimeConfig {
  gateway?: LLMGateway;
  character?: CharacterDefinition;
  eventDefinitions?: readonly EventDefinition[];
  providerConfig?: Omit<LLMProviderConfig, 'kind'> & { kind: LLMProviderConfig['kind'] };
  env?: Record<string, string | undefined>;
  combinedOptions?: CombinedGeneratorOptions;
  rng?: RNG;
  /** Node 环境可注入 JsonDirectorySaveRepository；浏览器默认 Memory 仓库。 */
  persistence?: SaveRepository;
  /** Project Policy：进入 system prompt 与生成约束。 */
  policy?: ProjectPolicy;
  /** LLM 生成失败重试次数（总调用 = maxAttempts + 1）；缺省 1。 */
  llmMaxAttempts?: number;
  /** 记忆容量上限，超过后按 strength+importance 修剪；缺省 100。 */
  memoryPruneLimit?: number;
  /** 叙事一致性规则：作用于 Scenario 与 Reaction 校验（U-4）。 */
  consistency?: {
    forbiddenTopics?: string[];
    allowedCharacters?: string[];
  };
  /** P0.5 Beat System 节奏预算（缺省 DEFAULT_FLOW_BUDGET）。 */
  flowBudget?: FlowBudgetConfig;
}

export type FlowPhase = 'awaiting-advance' | 'awaiting-choice';

export interface AdvanceView {
  turnId: string;
  beat: Beat;
  flowPhase: FlowPhase;
  flow: EventFlow;
  /** awaiting-choice 时为当前可选选项；否则为空。 */
  options: Option[];
  state: GameState;
}

export interface StartTurnView {
  turnId: string;
  scenario: { narrative: string; source: 'llm' | 'fallback' };
  options: Option[];
  /** P0：本 Turn 的开场过场（P0.5 起由 Beat 流替代，仅旧路径保留）。 */
  /** P0.5：本拍与流状态。 */
  beat?: Beat;
  flowPhase?: FlowPhase;
  state: GameState;
}

export interface ChooseTurnView {
  turnResult: TurnResult;
  scenarioText: string;
  reactionText: string;
  state: GameState;
}

const DEMO_LLM: LLMGateway = new TestProvider((request) => {
  const wantsOptions = request.messages.some((message) => message.content.includes('行为选项'));
  if (wantsOptions) {
    return {
      text: JSON.stringify({
        scenario: { narrative: '图书馆很安静，Mio 抬头看了你一眼。', structured: {} },
        options: [
          {
            id: 'option_active_1',
            presentation: { text: '需要我帮忙吗？', tone: 'supportive' },
            behavior: { actions: ['approach', 'support'], intent: ['care'], risk: 0.15 },
            gameplay: { progress: 2 },
            effects: { affection: { base: 2 }, trust: { base: 1 } },
            conditions: {},
            generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
          },
          {
            id: 'option_conservative_1',
            presentation: { text: '我先在旁边看看书。', tone: 'calm' },
            behavior: { actions: ['observe', 'wait'], intent: ['respect'], risk: 0.05 },
            gameplay: { progress: 0 },
            effects: { trust: { base: 1 } },
            conditions: {},
            generation: { must_fit_character: true, must_fit_context: true, variation: 'medium' },
          },
          {
            id: 'option_social_1',
            presentation: { text: '最近有什么推荐的书吗？', tone: 'friendly' },
            behavior: { actions: ['chat', 'ask'], intent: ['connect'], risk: 0.1 },
            gameplay: { progress: 1 },
            effects: { familiarity: { base: 2 } },
            conditions: {},
            generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
          },
          {
            id: 'option_risk_1',
            presentation: { text: '其实我想更了解你。', tone: 'bold' },
            behavior: { actions: ['challenge', 'confess'], intent: ['romance'], risk: 0.45 },
            gameplay: { progress: 2 },
            effects: { affection: { base: 3 }, conflict: { base: 1 } },
            conditions: {},
            generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
          },
        ],
      }),
    };
  }
  return {
    text: JSON.stringify({
      narrative: '……嗯，你来了。',
      structured: {
        emotion: { type: 'relief', intensity: 70 },
        intent: { type: 'seek_closeness', intensity: 50 },
        memoryCandidates: [
          {
            type: 'episodic',
            content: '玩家主动靠近并表达了关心。',
            importance: 40,
            emotionalIntensity: 25,
            valence: 10,
            tags: ['care'],
            relatedCharacters: ['char_mio'],
            sourceTurnId: 'run_001/day_001/turn_001',
          },
        ],
      },
    }),
  };
});

export class GameRuntime {
  readonly gateway: LLMGateway;
  readonly character: CharacterDefinition;
  readonly eventDefinitions: EventDefinition[];
  readonly persistence: SaveRepository;
  readonly policy?: ProjectPolicy;

  private rng: RNG;
  private readonly configuredRng?: RNG;
  private state?: GameState;
  private context?: ModelContext;
  private currentOptions: Option[] = [];
  private currentScenario?: StartTurnView['scenario'];
  private lastTurn?: TurnResult;
  private readonly eventPool: EventPool;
  private readonly contextCache = new ContextCache();
  private readonly llmMaxAttempts: number;
  private readonly memoryPruneLimit: number;
  private readonly consistency?: { forbiddenTopics?: string[]; allowedCharacters?: string[] };
  private lastOptionActions: string[] = [];
  /** P0.5 Beat System。 */
  private readonly flowController: FlowController;
  private flow?: EventFlow;
  private pendingBeats: Beat[] = [];
  private flowPhase: FlowPhase = 'awaiting-choice';
  private lastChoiceResolution?: string;

  constructor(config: RuntimeConfig = {}) {
    this.character = config.character ?? demoCharacter;
    this.eventDefinitions = [...(config.eventDefinitions ?? demoEvents)];
    this.gateway =
      config.gateway ??
      (config.providerConfig
        ? createGateway(config.providerConfig)
        : config.env
          ? createGateway(loadProviderConfigFromEnv(config.env))
          : DEMO_LLM);
    this.persistence = config.persistence ?? new MemorySaveRepository();
    this.policy = config.policy;
    this.llmMaxAttempts = config.llmMaxAttempts ?? 1;
    this.memoryPruneLimit = config.memoryPruneLimit ?? 100;
    this.consistency = config.consistency;
    this.flowController = new FlowController(config.flowBudget ?? DEFAULT_FLOW_BUDGET);
    this.configuredRng = config.rng;
    this.rng = config.rng ?? new XorShift128Rng(20260816);
    this.eventPool = new EventPool(this.eventDefinitions);
  }

  getState(): GameState {
    if (!this.state) throw new Error('Game has not started');
    return structuredClone(this.state);
  }

  getCurrentOptions(): Option[] {
    return structuredClone(this.currentOptions);
  }

  getContextCacheStats(): ContextCacheStats {
    return this.contextCache.getStats();
  }

  /**
   * P0.5：组装拍生成输入——事件内滚动上下文（beatSummaries 全量）+ 上轮结算摘要。
   */
  private buildBeatInput(state: GameState, context: ModelContext): BeatContextInput {
    const last = this.lastTurn;
    return {
      npcName: this.character.identity.name,
      npcId: this.character.characterId,
      systemRules: context.systemRules,
      currentState: state,
      lastTurn: last
        ? {
            optionActions: this.lastOptionActions,
            reactionSummary: last.reaction.narrative.slice(0, 120),
            newMemoryContents: last.newMemories.map((record) => record.content),
          }
        : undefined,
      retrievedMemories: context.retrievedMemories,
      timeChange: last
        ? {
            previous: last.stateBefore.run.time,
            current: state.run.time,
            crossedDayBoundary: last.stateBefore.run.day !== state.run.day,
          }
        : { previous: state.run.time, current: state.run.time, crossedDayBoundary: false },
      locationChange: {
        fromLocationId: last?.stateBefore.world.currentLocationId ?? null,
        toLocationId: state.world.currentLocationId,
      },
      flow: {
        beatsUsed: this.flow?.beatsUsed ?? 0,
        choicesUsed: this.flow?.choicesUsed ?? 0,
        beatSummaries: this.flow?.beatSummaries ?? [],
        pendingTension: this.flow?.pendingTension,
      },
      lastChoiceResolution: this.lastChoiceResolution,
    };
  }

  /** 选择区间结算摘要：进入后续文段拍的"余波"素材。 */
  private summarizeResolution(resolution: { directDelta: FinalStateDelta }): string | undefined {
    const entries = Object.entries(resolution.directDelta.relationships ?? {}).flatMap(
      ([, metrics]) =>
        Object.entries(metrics).map(
          ([metric, change]) => `${metric} ${change.before}→${change.after}`,
        ),
    );
    return entries.length > 0 ? entries.join('，') : undefined;
  }

  startGame(seed = 20260816): GameState {
    this.rng = this.configuredRng ?? new XorShift128Rng(seed);
    const definition = this.character;
    let state = createGameState({ runId: 'run_001', seed, day: 1, time: '09:00' });
    if (this.rng instanceof XorShift128Rng) {
      state.rng = this.rng.save();
    }
    state.characters[definition.characterId] = definitionToGameCharacter(definition);
    state.relationships[`rel_player_${definition.characterId}`] = defaultRelationship(
      'player',
      definition.characterId,
      `rel_player_${definition.characterId}`,
      {
        type: definition.relationshipDefaults.initialType,
        ...definition.relationshipDefaults.metrics,
        affection: 0,
        trust: 0,
      },
    );
    const bootEvent = this.eventDefinitions[0];
    if (bootEvent) {
      state = commitTriggeredEvent(state, bootEvent, {
        instanceId: 'event_boot',
        eventId: bootEvent.eventId,
        runId: state.run.runId,
        day: 1,
        turn: 0,
        locationId: state.world.currentLocationId,
        title: bootEvent.title,
        description: bootEvent.description,
        status: 'resolved',
        createdAt: { day: 1, time: '09:00' },
      });
    }
    this.state = state;
    this.currentOptions = [];
    this.currentScenario = undefined;
    this.lastTurn = undefined;
    this.flow = undefined;
    this.pendingBeats = [];
    this.flowPhase = 'awaiting-choice';
    this.lastChoiceResolution = undefined;
    this.lastOptionActions = [];
    return this.getState();
  }

  async startTurn(): Promise<StartTurnView> {
    const prepared = await this.prepareTurnContext();
    const outcome = await this.produceBeat(this.getState(), prepared);

    return {
      turnId: prepared.turnId,
      scenario: structuredClone(this.currentScenario!),
      options: this.getCurrentOptions(),
      beat: structuredClone(outcome.beat),
      flowPhase: this.flowPhase,
      state: this.getState(),
    };
  }

  /**
   * 事件选择 + 流开启 + Context 组装。
   * P0.5：当前流已结束时自动滚动到下一事件（advance 与 startTurn 共用）。
   */
  private async prepareTurnContext(forceNewEvent = false): Promise<ModelContext> {
    const state = this.getState();
    const needOpen = forceNewEvent || !this.flow || this.flow.status === 'ended';
    if (!needOpen && this.context) return this.context;

    const selectedEvent = this.eventPool.trySelectEvent(state, this.rng);
    let next = state;
    if (selectedEvent) {
      next = commitTriggeredEvent(
        state,
        this.eventDefinitions.find((event) => event.eventId === selectedEvent.eventId)!,
        selectedEvent,
        this.eventPool,
      );
    }
    this.state = next;

    const importance = selectedEvent
      ? (this.eventDefinitions.find((event) => event.eventId === selectedEvent.eventId)
          ?.importance ?? 'side')
      : (this.flow?.importance ?? 'side');
    this.flow = this.flowController.openFlow(selectedEvent?.eventId ?? null, importance, () =>
      this.rng.next(),
    );
    this.pendingBeats = [];

    const context = buildContext(next, {
      characterId: this.character.characterId,
      systemRules: buildSystemRules(this.character.identity.name, this.policy),
      cache: this.contextCache,
      currentEvent: selectedEvent,
      query: { tags: selectedEvent ? [selectedEvent.eventId] : ['library'] },
    });

    // Retrieval → Reinforcement：本轮被召回的记忆按设计语义获得强化。
    const retrievalCognition = next.characters[this.character.characterId]?.cognition;
    if (retrievalCognition && context.retrievedMemories.length > 0) {
      for (const record of context.retrievedMemories) {
        next = reinforceMemoryRecord(next, record.id, next.run.day);
      }
    }
    this.state = next;
    this.context = context;
    return context;
  }

  /** P0.5：推进下一拍（仅文段阶段合法）；流结束则自动滚动到下一事件。 */
  async advance(): Promise<AdvanceView> {
    if (this.flowPhase !== 'awaiting-advance') {
      throw new Error('Not awaiting an advance; choose an option or start the next turn');
    }
    const context =
      this.flow && this.flow.status !== 'ended' && this.context
        ? this.context
        : await this.prepareTurnContext();
    const outcome = await this.produceBeat(this.getState(), context);
    return {
      turnId: context.turnId,
      beat: structuredClone(outcome.beat),
      flowPhase: this.flowPhase,
      flow: structuredClone(this.flow!),
      options: this.getCurrentOptions(),
      state: this.getState(),
    };
  }

  getFlowState(): EventFlow | undefined {
    return this.flow ? structuredClone(this.flow) : undefined;
  }

  /**
   * P0.5 核心：FlowController 裁决下一拍类型 → 生成 → 登记。
   * 文段拍进入 awaiting-advance；选择拍进入 awaiting-choice 并填充 currentOptions。
   */
  private async produceBeat(state: GameState, context: ModelContext): Promise<{ beat: Beat }> {
    if (!this.flow) throw new Error('Flow not initialized');

    // 预算耗尽（无剩余选择）→ 事件收束：产出收尾文段并结束流；
    // 下一次 advance/startTurn 将自动开启新事件。
    if (this.flow.status === 'ended' || this.flow.beatsUsed >= this.flow.maxBeats) {
      const closings = [
        `（${state.run.time}）这一段时光告一段落，空气里的情绪慢慢沉淀下来。`,
        `（${state.run.time}）话题渐渐落下帷幕，她望向窗外，像是在为刚才的一切画上句点。`,
        `（${state.run.time}）喧闹退去，两人之间留下一段安静而余韵未散的空白。`,
      ];
      const pick = closings[Math.floor(this.rng.next() * closings.length)] ?? closings[0]!;
      const closing: Beat = {
        beatId: `${this.flow.beatsUsed + 1}`.padStart(3, '0'),
        kind: 'narrative',
        narration: pick,
        dialogues: [],
        source: 'fallback',
        branchPotential: 'mid',
      };
      this.flow = { ...this.flow, status: 'ended' };
      this.flowPhase = 'awaiting-advance';
      this.currentOptions = [];
      this.currentScenario = { narrative: pick, source: closing.source };
      return { beat: closing };
    }

    const step = this.flowController.nextStep(this.flow);
    const input = this.buildBeatInput(state, context);

    if (step === 'choice') {
      const result = await generateChoiceBeat(input, this.gateway, {
        maxAttempts: this.llmMaxAttempts,
        consistency: this.consistency,
      });
      const beat: ChoiceBeat = {
        beatId: result.beatId,
        kind: 'choice',
        intro: result.intro,
        options: result.options,
        source: result.source,
      };
      this.flow = this.flowController.registerBeat(this.flow, beat, result.intro ?? '（选择点）');
      this.flowPhase = 'awaiting-choice';
      this.currentOptions = [...result.options];
      this.currentScenario = { narrative: result.intro ?? '', source: result.source };
      this.pendingBeats.push(beat);
      return { beat };
    }

    const beats = await generateNarrativeBeats(input, this.gateway, {
      maxAttempts: this.llmMaxAttempts,
      consistency: this.consistency,
      maxBeats: 1,
    });
    let beat = beats[0]!;
    // 情绪漂移（D4）：clamp ±3 后作用于 psychology 同名指标或 emotion 数值字段。
    if (beat.emotionDrift) {
      state = this.applyEmotionDrift(state, beat.emotionDrift);
    }
    beat = { ...beat, emotionDrift: undefined };
    this.flow = this.flowController.registerBeat(this.flow, beat, beat.narration.slice(0, 60));
    // 思维链→扮演对象：内心动机回流为 pendingTension，驱动后续拍并作为 P1 Pending Intent 的数据源。
    if (beat.motive) {
      this.flow = { ...this.flow, pendingTension: beat.motive };
    }
    this.flowPhase = 'awaiting-advance';
    this.currentOptions = [];
    this.currentScenario = { narrative: beat.narration, source: beat.source };
    this.pendingBeats.push(beat);

    if (this.flow.status !== undefined && this.flow.beatsUsed >= this.flow.maxBeats) {
      this.flow = { ...this.flow, status: 'ended' };
    }
    this.state = state;
    return { beat };
  }

  /** D4：轻量情绪漂移，clamp ±3。 */
  private applyEmotionDrift(state: GameState, drift: Record<string, number>): GameState {
    const next = cloneGameState(state);
    const characterId = this.character.characterId;
    const character = next.characters[characterId];
    if (!character) return state;
    const clampDrift = (value: number, delta: number) =>
      Math.max(0, Math.min(100, value + Math.max(-3, Math.min(3, delta))));
    for (const [metric, delta] of Object.entries(drift)) {
      if (metric in character.psychology) {
        const psychology = character.psychology as unknown as Record<string, number>;
        psychology[metric] = clampDrift(psychology[metric] ?? 50, delta ?? 0);
      } else if (metric === 'valence' || metric === 'intensity' || metric === 'energy') {
        character.emotion[metric] = clampDrift(character.emotion[metric] ?? 50, delta ?? 0);
      }
    }
    return next;
  }

  async chooseOption(optionId: string): Promise<ChooseTurnView> {
    if (this.flowPhase !== 'awaiting-choice') {
      throw new Error('Not awaiting a choice; call advance() to continue the narrative flow');
    }
    const state = this.getState();
    const option = this.currentOptions.find((candidate) => candidate.id === optionId);
    if (!option) throw new Error(`Unknown optionId: ${optionId}`);
    if (!this.context) throw new Error('No active turn; call startTurn first');
    this.lastOptionActions = [...option.behavior.actions];

    const transaction = startTurnTransaction(state);
    const impactScale = importanceImpactScale(this.flow?.importance ?? 'side');
    const resolution = transaction.resolveChoice(option, {
      rng: this.rng,
      impactMultiplier: impactScale,
    });
    const reaction = await generateReaction(
      this.context,
      state,
      option,
      this.gateway,
      { maxAttempts: this.llmMaxAttempts, consistency: this.consistency },
      resolution,
    );

    const secondaryDelta = resolveSecondaryDelta(state, option, reaction.structured);
    let next = applyDelta(transaction.getState(), secondaryDelta);
    next = updatePlayerModelFromTurn(next, option, reaction.structured);

    const cognition = next.characters[this.character.characterId]?.cognition;
    if (cognition) {
      for (const candidate of reaction.structured.memoryCandidates ?? []) {
        const formed = formMemory(next, candidate, cognition);
        next = formed.state;
      }
      if (resolution.crossedDayBoundary) {
        next = consolidateMemories(next, state.run.day, cognition);
      }
    }
    next = pruneMemories(next, { maxRecords: this.memoryPruneLimit });
    transaction.settle(() => next);
    transaction.setSecondaryDelta(secondaryDelta);
    transaction.setReaction({ narrative: reaction.narrative, structured: reaction.structured });
    // P0.5：本次选择区间内积累的拍随 TurnResult 原子提交。
    if (this.pendingBeats.length > 0) {
      transaction.setBeats(this.pendingBeats);
      this.pendingBeats = [];
    }
    if (this.flow) {
      this.flow = { ...this.flow, status: 'flowing', pendingTension: undefined };
    }
    this.lastChoiceResolution = this.summarizeResolution(resolution);

    const scenarioText = this.currentScenario?.narrative ?? '';
    const turnResult = transaction.commitTurn();
    this.state = turnResult.finalState;
    this.lastTurn = turnResult;
    this.currentOptions = [];
    this.currentScenario = undefined;
    this.context = undefined;

    return {
      turnResult,
      scenarioText,
      reactionText: reaction.narrative,
      state: this.getState(),
    };
  }

  endRun(ending: EndingDefinition): GameState {
    const current = this.getState();
    const next =
      ending.kind === 'bad'
        ? applyBadEndPunishment(current, ending)
        : applyMetaProgression(current, ending);
    this.state = next;
    this.currentOptions = [];
    this.currentScenario = undefined;
    this.context = undefined;
    return this.getState();
  }

  setPermanentModifier(key: string, value: number): GameState {
    const next = this.getState();
    next.meta.permanentModifiers[key] = value;
    this.state = next;
    return this.getState();
  }

  startNewRun(seed = 20260817): GameState {
    const definition = this.character;
    const previousMeta = this.state?.meta;
    const state = createGameState({
      runId: `run_${previousMeta ? previousMeta.runCount + 1 : 1}`,
      seed,
    });
    if (previousMeta) {
      state.meta = structuredClone(previousMeta);
      state.meta.runCount += 1;
    }
    state.characters[definition.characterId] = definitionToGameCharacter(definition);
    const relationship = defaultRelationship(
      'player',
      definition.characterId,
      `rel_player_${definition.characterId}`,
      {
        type: definition.relationshipDefaults.initialType,
        affection: Math.max(
          0,
          Math.min(100, state.meta.permanentModifiers.starting_affection ?? 0),
        ),
        trust: Math.max(0, Math.min(100, state.meta.permanentModifiers.starting_trust ?? 0)),
      },
    );
    state.relationships[relationship.relationshipId] = relationship;
    this.state = state;
    this.currentOptions = [];
    this.currentScenario = undefined;
    this.context = undefined;
    this.lastTurn = undefined;
    this.flow = undefined;
    this.pendingBeats = [];
    this.flowPhase = 'awaiting-choice';
    this.lastChoiceResolution = undefined;
    this.lastOptionActions = [];
    return this.getState();
  }

  async save(saveId: string): Promise<GameState> {
    await this.persistence.save(saveId, this.getState());
    return this.getState();
  }

  async load(saveId: string): Promise<GameState> {
    const saved = await this.persistence.load<GameState>(saveId);
    this.state = structuredClone(saved);
    this.currentOptions = [];
    this.context = undefined;
    this.currentScenario = undefined;
    this.flow = undefined;
    this.pendingBeats = [];
    this.flowPhase = 'awaiting-choice';
    this.lastChoiceResolution = undefined;
    this.lastOptionActions = [];
    return this.getState();
  }

  export(): string {
    return JSON.stringify({ gameState: this.getState(), lastTurn: this.lastTurn }, null, 2);
  }
}

function buildSystemRules(characterName: string, policy?: ProjectPolicy): string {
  const constraints = Object.entries(policy?.generationConstraints ?? {}).map(
    ([key, value]) => `${key}: ${value}`,
  );
  const content = [
    `你是${characterName}，保持角色一致性。`,
    policy ? `语气：${policy.narrativeTone}` : '',
    policy?.contentTags.length ? `允许标签：${policy.contentTags.join('、')}` : '',
    policy?.matureThemes.length
      ? `成熟主题（需符合项目政策）：${policy.matureThemes.join('、')}`
      : '',
    constraints.length ? `生成约束：${constraints.join('；')}` : '',
  ].filter(Boolean);
  return content.join('\n');
}
