import type { CharacterState } from './character.js';
import type { CharacterDefinition } from './character-definition.js';
import type { ModelContext } from './context.js';
import type { EventDefinition, EventInstance, EventResult } from './event.js';
import type { GameState } from './game-state.js';
import type { MemoryCandidate, MemoryRecord, MemoryState } from './memory.js';
import type { MetaState } from './meta.js';
import type { Option } from './option.js';
import type { PlayerModel } from './player-model.js';
import type { GameProject } from './project.js';
import type { RelationshipState } from './relationship.js';
import type { RNGState } from './rng.js';
import type { SaveSnapshot } from './save.js';
import type { BaseStateDelta, FinalStateDelta, ModifierStateDelta } from './state-delta.js';
import type { TurnResult } from './turn-result.js';
import type { WorldState } from './world.js';

export const characterId = 'char_mio';
export const relationshipId = 'rel_player_mio';
export const runId = 'run_017';
export const turnId = 'run_017/day_001/turn_001';

export function makeCharacterState(id = characterId): CharacterState {
  return {
    characterId: id,
    identity: {
      name: 'Mio',
      age: 19,
      gender: 'female',
      genderIdentity: 'female',
      sexualOrientation: 'pansexual',
      role: '图书馆管理员',
      description: '安静但观察力敏锐的图书管理员。',
    },
    personality: {
      traits: { gentle: 80, observant: 85 },
      independence: 80,
      confidence: 55,
      sociability: 40,
      sensitivity: 75,
      assertiveness: 45,
      empathy: 80,
      openness: 60,
    },
    psychology: {
      dependence: 30,
      security: 55,
      loneliness: 60,
      stress: 35,
      jealousy: 15,
      selfWorth: 50,
      emotionalStability: 60,
      romanticTension: 20,
    },
    emotion: {
      primary: 'calm',
      secondary: 'curious',
      intensity: 30,
      valence: 10,
      energy: 55,
    },
    cognition: {
      memoryCapacity: 80,
      encoding: 70,
      retention: 75,
      retrieval: 65,
      forgetfulness: 30,
      grudge: 20,
      obsession: 25,
      attention: 70,
      emotionalSalience: 60,
      cognitiveLoad: 30,
    },
    physical: {
      energy: 70,
      fatigue: 25,
      health: 90,
      hunger: 20,
      sleepiness: 15,
    },
    activity: {
      locationId: 'loc_library',
      activity: '整理书架',
      availability: 80,
      scheduleState: 'work',
      currentGoal: '在闭馆前整理完新书',
    },
    status: 'active',
  };
}

export function makeWorldState(): WorldState {
  return {
    day: 1,
    time: '09:00',
    weekday: 'monday',
    season: 'spring',
    weather: { type: 'clear', intensity: 10, temperature: 18, visibility: 90 },
    currentLocationId: 'loc_library',
    locations: {
      loc_library: {
        locationId: 'loc_library',
        name: '图书馆',
        type: 'library',
        tags: ['quiet', 'study'],
        accessibility: 100,
        active: true,
        currentCharacters: [characterId],
      },
    },
    publicEvents: [],
    activeEvents: [],
    worldFlags: { tutorial_done: true },
  };
}

export function makePlayerModel(): PlayerModel {
  return {
    perceivedTraits: { kind: 60, reliable: 55 },
    perceivedIntentions: { care: 50 },
    behavioralPatterns: { player_help: 7, player_flirt: 3 },
    recentBehaviorPattern: ['help', 'help', 'help'],
    reliability: 60,
    honesty: 65,
    caring: 55,
    confidence: 50,
    romanticInterest: 30,
    perceivedControl: 40,
  };
}

export function makeMemoryRecord(id = 'mem_001'): MemoryRecord {
  return {
    id,
    type: 'episodic',
    content: '玩家在图书馆帮 Mio 整理了新书。',
    createdAt: { day: 1, time: '09:00' },
    importance: 40,
    emotionalIntensity: 25,
    valence: 15,
    strength: 45,
    accuracy: 90,
    tags: ['library', 'help'],
    relatedCharacters: [characterId],
    sourceTurnId: turnId,
    retrievalCount: 0,
    lastRetrievedAt: { day: 1, time: '09:30' },
  };
}

export function makeMemoryCandidate(): MemoryCandidate {
  return {
    type: 'episodic',
    content: '玩家主动提出帮忙整理书架。',
    importance: 40,
    emotionalIntensity: 25,
    valence: 15,
    tags: ['library', 'help'],
    relatedCharacters: [characterId],
    sourceTurnId: turnId,
  };
}

export function makeMemoryState(): MemoryState {
  return {
    records: { mem_001: makeMemoryRecord('mem_001') },
    shortTermIds: ['mem_001'],
    longTermIds: [],
    forgottenIds: [],
    lastConsolidatedDay: 1,
  };
}

export function makeMetaState(): MetaState {
  return {
    runCount: 17,
    completedRuns: 2,
    knowledge: {
      know_001: {
        id: 'know_001',
        title: 'Mio 讨厌雨天被打扰',
        content: '雨天她在整理旧报刊时不喜欢被打断。',
        tags: ['mio', 'rain'],
        sourceRunId: 'run_003',
        acquiredAt: { day: 4, time: '17:20' },
      },
    },
    memories: [
      {
        id: 'meta_mem_001',
        content: '上次失败是因为在雨天连续追问她的过去。',
        createdAt: { day: 6, time: '20:00' },
        importance: 70,
        tags: ['lesson'],
        sourceRunId: 'run_016',
      },
    ],
    unlocks: ['location_rooftop'],
    achievements: ['first_meeting'],
    endingsDiscovered: ['bad_end_rain'],
    permanentModifiers: { luck: 1 },
  };
}

export function makeRngState(): RNGState {
  return { seed: 123456789, state: [123456789], algorithm: 'xorshift128' };
}

export function makeRelationshipState(id = relationshipId): RelationshipState {
  return {
    relationshipId: id,
    sourceId: 'player',
    targetId: characterId,
    type: 'acquaintance',
    affection: 30,
    trust: 40,
    intimacy: 10,
    familiarity: 35,
    attraction: 25,
    conflict: 5,
    respect: 50,
    dependency: 10,
    currentLabel: '图书管理员与常客',
    tags: ['library'],
    status: 'active',
    customMetrics: {},
  };
}

export function makeGameState(): GameState {
  return {
    schemaVersion: '0.1.0',
    run: {
      runId,
      startedAt: '2026-08-16T09:00:00Z',
      day: 1,
      turn: 1,
      time: '09:00',
      dailyProgress: 0,
      dailyProgressLimit: 12,
      currentEventId: 'event_001',
      currentLocationId: 'loc_library',
      status: 'active',
    },
    world: makeWorldState(),
    characters: { [characterId]: makeCharacterState() },
    relationships: { [relationshipId]: makeRelationshipState() },
    flags: { tutorial_done: true },
    playerModel: makePlayerModel(),
    memories: makeMemoryState(),
    meta: makeMetaState(),
    rng: makeRngState(),
  };
}

export function makeOption(id = 'option_001'): Option {
  return {
    id,
    presentation: { text: '这次你自己试试看，我相信你。', tone: 'supportive' },
    behavior: {
      actions: ['support', 'respect', 'encourage_independence'],
      intent: ['care', 'encouragement'],
      risk: 0.15,
    },
    gameplay: { progress: 2 },
    effects: { affection: { base: 2 }, trust: { base: 4 } },
    conditions: { trust: { min: 20 } },
    generation: { must_fit_character: true, must_fit_context: true, variation: 'high' },
  };
}

export function makeBaseDelta(): BaseStateDelta {
  return {
    phase: 'base',
    run: { dailyProgressDelta: 2 },
    relationships: { [relationshipId]: { affection: 2, trust: 4 } },
    flags: { set: { helped_today: true }, unset: ['avoided_today'] },
    memoryCandidates: [makeMemoryCandidate()],
  };
}

export function makeModifierDelta(): ModifierStateDelta {
  return {
    phase: 'modifier',
    modifiers: {
      [`relationship:${relationshipId}.affection.personality`]: 1.2,
      [`relationship:${relationshipId}.affection.emotion`]: 0.9,
    },
    riskOutcome: 'success',
  };
}

export function makeFinalDelta(): FinalStateDelta {
  return {
    phase: 'final',
    run: { dailyProgress: 2 },
    relationships: {
      [relationshipId]: {
        affection: { before: 30, after: 32, delta: 2 },
        trust: { before: 40, after: 44, delta: 4 },
      },
    },
    flags: { set: { helped_today: true }, unset: ['avoided_today'] },
    memoryCandidates: [makeMemoryCandidate()],
  };
}

export function makeEventDefinition(): EventDefinition {
  return {
    eventId: 'event_rainy_library',
    importance: 'side',
    type: 'daily',
    rarity: 'common',
    title: '雨天的图书馆',
    description: '窗外下起雨，图书馆比平时更安静。',
    baseWeight: 10,
    conditions: { 'world.weather.type': 'rain' },
    cooldown: { days: 1, turns: 0 },
    allowedLocationIds: ['loc_library'],
    tags: ['rain', 'quiet'],
    requiresCharacterIds: [characterId],
    behaviorConstraints: ['avoid_aggressive'],
  };
}

export function makeEventInstance(): EventInstance {
  return {
    instanceId: 'event_instance_001',
    eventId: 'event_rainy_library',
    runId,
    day: 1,
    turn: 1,
    locationId: 'loc_library',
    title: '雨天的图书馆',
    description: '窗外下起雨，图书馆比平时更安静。',
    status: 'active',
    createdAt: { day: 1, time: '09:00' },
  };
}

export function makeEventResult(): EventResult {
  return {
    instanceId: 'event_instance_001',
    eventId: 'event_rainy_library',
    outcome: 'completed',
    finalDelta: makeFinalDelta(),
    endingTriggered: false,
    resolvedAt: { day: 1, time: '09:20' },
  };
}

export function makeTurnResult(): TurnResult {
  return {
    schemaVersion: '0.1.0',
    turnId,
    runId,
    stateBefore: makeGameState(),
    choice: { turnId, optionId: 'option_001' },
    directDelta: makeFinalDelta(),
    reaction: {
      narrative: '谢谢……其实我今天不太想一个人。',
      structured: {
        emotion: { type: 'relief', intensity: 70 },
        intent: { type: 'seek_closeness', intensity: 50 },
        memoryCandidates: [makeMemoryCandidate()],
      },
    },
    secondaryDelta: {
      phase: 'final',
      characters: {
        [characterId]: {
          psychology: {
            loneliness: { before: 60, after: 55, delta: -5 },
          },
        },
      },
    },
    newMemories: [makeMemoryRecord('mem_001')],
    playerModel: makePlayerModel(),
    worldUpdate: makeWorldState(),
    finalState: makeGameState(),
  };
}

export function makeModelContext(): ModelContext {
  return {
    schemaVersion: '0.1.0',
    runId,
    turnId,
    day: 1,
    time: '09:00',
    systemRules: '你是图书馆管理员 Mio。规则：保持角色一致性；输出双通道结构。',
    currentState: makeGameState(),
    currentEvent: makeEventInstance(),
    recentEvents: [makeEventInstance()],
    retrievedMemories: [makeMemoryRecord('mem_001')],
    internalState: { focus: 'work', openness: 0.4 },
    generationTask: { task: 'generate_scenario_and_options', outputSchema: 'option.schema.json' },
    budget: {
      capacity: 80,
      systemRules: 15,
      currentState: 15,
      recentEvents: 20,
      memories: 20,
      internalState: 10,
    },
  };
}

export function makeSaveSnapshot(): SaveSnapshot {
  return {
    schemaVersion: '0.1.0',
    metadata: {
      saveId: 'save_001',
      runId,
      label: 'Day 1 开始',
      createdAt: { day: 1, time: '09:00' },
      day: 1,
      turn: 1,
    },
    gameState: makeGameState(),
    turnHistory: [makeTurnResult()],
  };
}

export function makeCharacterDefinition(): CharacterDefinition {
  return {
    schemaVersion: '0.1.0',
    characterId,
    identity: makeCharacterState().identity,
    personality: makeCharacterState().personality,
    preferences: { likes: ['书', '安静'], dislikes: ['噪音'], interests: ['文学'] },
    speech: { style: '轻声', tone: '温和', vocabulary: ['书', '谢谢'], examples: ['……嗯。'] },
    psychologyDefaults: makeCharacterState().psychology,
    cognition: makeCharacterState().cognition,
    relationshipDefaults: {
      initialType: 'stranger',
      metrics: { affection: 0, trust: 0 },
      tags: [],
    },
    secrets: [{ id: 'secret_001', content: '害怕雷声。', revealCondition: 'trust >= 70' }],
    goals: [{ id: 'goal_001', description: '考取图书管理资格证', priority: 60, progress: 30 }],
    boundaries: ['不讨论家庭'],
    gameParameters: { affection_gain_rate: 1 },
  };
}

export function makeProject(): GameProject {
  return {
    schemaVersion: '0.1.0',
    projectId: 'project_tavern_library',
    name: '雨天的图书馆',
    version: '0.1.0',
    description: '一个关于图书馆与雨天相遇的短篇 AI GALGAME。',
    policy: {
      ageRating: 'all_ages',
      relationshipTypes: ['acquaintance', 'friend', 'romantic_interest'],
      contentTags: ['slice_of_life'],
      narrativeTone: 'gentle',
      matureThemes: [],
      generationConstraints: { avoid: 'violence' },
    },
    characters: [makeCharacterDefinition()],
    world: {
      worldId: 'world_library',
      name: '雨天的图书馆',
      description: '只有一间图书馆的小世界。',
      dailyProgressLimit: 12,
      startDay: 1,
      startTime: '09:00',
      startWeekday: 'monday',
      startSeason: 'spring',
      locations: [
        {
          locationId: 'loc_library',
          name: '图书馆',
          type: 'library',
          tags: ['quiet'],
          accessibility: 100,
          description: '安静的小图书馆。',
        },
      ],
      initialWorldFlags: { tutorial_done: true },
    },
    parameters: { dayLength: 12 },
    optionTemplates: [
      {
        templateId: 'opt_support',
        behavior: makeOption().behavior,
        effects: makeOption().effects,
        conditions: makeOption().conditions,
        generation: makeOption().generation,
        presentationVariants: ['需要我帮忙吗？', '这次你自己试试看。'],
      },
    ],
    events: [makeEventDefinition()],
    endings: [
      {
        endingId: 'ending_friends',
        kind: 'normal',
        title: '普通朋友',
        description: '你们成为了朋友。',
        conditions: { 'relationship.affection': { min: 30 } },
        priority: 10,
      },
    ],
    prompts: { scenario: '生成当前场景...' },
    assets: { background_library: 'assets/bg/library.png' },
  };
}
