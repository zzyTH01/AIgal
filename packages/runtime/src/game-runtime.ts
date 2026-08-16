import {
  type CharacterDefinition,
  type EventDefinition,
  type GameState,
  type ModelContext,
  type Option,
  type TurnResult,
} from '@ag/schemas';
import { createGameState, defaultRelationship, startTurn, type RNG } from '@ag/core';
import { EventPool, XorShift128Rng, commitTriggeredEvent } from '@ag/world';
import { MemorySaveRepository, type SaveRepository } from '@ag/persistence';
import { definitionToGameCharacter } from '@ag/st-adapter';
import { buildContext } from '@ag/context';
import { formMemory, consolidateMemories } from '@ag/memory';
import {
  generateScenarioAndOptions,
  generateReaction,
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
}

export interface StartTurnView {
  turnId: string;
  scenario: { narrative: string; source: 'llm' | 'fallback' };
  options: Option[];
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
  return { text: JSON.stringify({ narrative: '……嗯，你来了。', structured: {} }) };
});

export class GameRuntime {
  readonly gateway: LLMGateway;
  readonly character: CharacterDefinition;
  readonly eventDefinitions: EventDefinition[];
  readonly persistence: SaveRepository;

  private rng: RNG;
  private readonly configuredRng?: RNG;
  private state?: GameState;
  private context?: ModelContext;
  private currentOptions: Option[] = [];
  private currentScenario?: StartTurnView['scenario'];
  private lastTurn?: TurnResult;
  private readonly eventPool: EventPool;

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
    return this.getState();
  }

  async startTurn(): Promise<StartTurnView> {
    const state = this.getState();
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

    const context = buildContext(next, {
      characterId: this.character.characterId,
      systemRules: `你是${this.character.identity.name}，保持角色一致性。`,
      currentEvent: selectedEvent,
      query: { tags: selectedEvent ? [selectedEvent.eventId] : ['library'] },
    });
    const generated = await generateScenarioAndOptions(context, this.gateway, {
      maxAttempts: 1,
    });
    this.context = context;
    this.currentOptions = generated.options;
    this.currentScenario = {
      narrative: generated.scenario.narrative,
      source: generated.source,
    };

    return {
      turnId: context.turnId,
      scenario: structuredClone(this.currentScenario),
      options: this.getCurrentOptions(),
      state: this.getState(),
    };
  }

  async chooseOption(optionId: string): Promise<ChooseTurnView> {
    const state = this.getState();
    const option = this.currentOptions.find((candidate) => candidate.id === optionId);
    if (!option) throw new Error(`Unknown optionId: ${optionId}`);
    if (!this.context) throw new Error('No active turn; call startTurn first');

    const transaction = startTurn(state);
    const resolution = transaction.resolveChoice(option, { rng: this.rng });
    const reaction = await generateReaction(
      this.context,
      state,
      option,
      this.gateway,
      { maxAttempts: 1 },
      resolution,
    );

    let next = transaction.getState();
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
    transaction.settle(() => next);

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
    return this.getState();
  }

  export(): string {
    return JSON.stringify({ gameState: this.getState(), lastTurn: this.lastTurn }, null, 2);
  }
}
