import {
  finalStateDeltaSchema,
  gameStateSchema,
  type CharacterActivityState,
  type CharacterState,
  type FinalStateDelta,
  type FlagsPatch,
  type GameState,
  type MemoryRecord,
  type MetaPatch,
  type MetricChange,
  type RelationshipState,
  type RunState,
  type WorldState,
} from '@ag/schemas';

/** 纯函数数值 Clamp。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 深拷贝 GameState；Turn 事务回滚基于该副本。 */
export function cloneGameState<T>(state: T): T {
  return structuredClone(state);
}

/** 将状态中全部 0~100 数值拉回合法区间（情绪 valence 使用 -100~100）。 */
export function clampStateValues(state: GameState): GameState {
  const next = cloneGameState(state);

  for (const character of Object.values(next.characters)) {
    character.personality = clampNumericObject(character.personality, 0, 100);
    character.psychology = clampNumericObject(character.psychology, 0, 100);
    character.emotion = clampNumericObject(character.emotion, 0, 100);
    character.emotion.valence = clamp(character.emotion.valence, -100, 100);
    character.cognition = clampNumericObject(character.cognition, 0, 100);
    character.physical = clampNumericObject(character.physical, 0, 100);
    character.activity.availability = clamp(character.activity.availability, 0, 100);
  }

  for (const relationship of Object.values(next.relationships)) {
    for (const key of [
      'affection',
      'trust',
      'intimacy',
      'familiarity',
      'attraction',
      'conflict',
      'respect',
      'dependency',
    ] as const) {
      relationship[key] = clamp(relationship[key], 0, 100);
    }
    for (const key of Object.keys(relationship.customMetrics)) {
      relationship.customMetrics[key] = clamp(relationship.customMetrics[key] ?? 0, 0, 100);
    }
  }

  next.world.weather.intensity = clamp(next.world.weather.intensity, 0, 100);
  next.world.weather.visibility = clamp(next.world.weather.visibility, 0, 100);
  for (const location of Object.values(next.world.locations)) {
    location.accessibility = clamp(location.accessibility, 0, 100);
  }

  next.run.dailyProgress = clamp(next.run.dailyProgress, 0, next.run.dailyProgressLimit);

  return next;
}

function clampNumericObject<T extends object>(value: T, min: number, max: number): T {
  const next: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(next)) {
    const field = next[key];
    if (typeof field === 'number') {
      next[key] = clamp(field, min, max);
    } else if (field !== null && typeof field === 'object' && !Array.isArray(field)) {
      next[key] = clampNumericObject(field as Record<string, unknown>, min, max);
    }
  }
  return next as T;
}

/** 创建一个合法的默认角色（用于测试与 Phase 11 模拟）。 */
export function defaultCharacter(
  characterId: string,
  overrides: Partial<CharacterState> = {},
): CharacterState {
  const base: CharacterState = {
    characterId,
    identity: {
      name: characterId,
      age: 18,
      gender: 'unknown',
      genderIdentity: 'unknown',
      sexualOrientation: 'unknown',
      role: 'character',
      description: '',
    },
    personality: {
      traits: {},
      independence: 50,
      confidence: 50,
      sociability: 50,
      sensitivity: 50,
      assertiveness: 50,
      empathy: 50,
      openness: 50,
    },
    psychology: {
      dependence: 50,
      security: 50,
      loneliness: 50,
      stress: 50,
      jealousy: 50,
      selfWorth: 50,
      emotionalStability: 50,
      romanticTension: 50,
    },
    emotion: {
      primary: 'neutral',
      intensity: 50,
      valence: 0,
      energy: 50,
    },
    cognition: {
      memoryCapacity: 50,
      encoding: 50,
      retention: 50,
      retrieval: 50,
      forgetfulness: 50,
      grudge: 50,
      obsession: 50,
      attention: 50,
      emotionalSalience: 50,
      cognitiveLoad: 50,
    },
    physical: {
      energy: 50,
      fatigue: 50,
      health: 50,
      hunger: 50,
      sleepiness: 50,
    },
    activity: {
      locationId: 'loc_start',
      activity: 'idle',
      availability: 100,
    },
    status: 'active',
  };

  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    personality: { ...base.personality, ...overrides.personality },
    psychology: { ...base.psychology, ...overrides.psychology },
    emotion: { ...base.emotion, ...overrides.emotion },
    cognition: { ...base.cognition, ...overrides.cognition },
    physical: { ...base.physical, ...overrides.physical },
    activity: { ...base.activity, ...overrides.activity },
  };
}

export function defaultRelationship(
  sourceId: string,
  targetId: string,
  relationshipId = `rel_${sourceId}_${targetId}`,
  overrides: Partial<RelationshipState> = {},
): RelationshipState {
  const base: RelationshipState = {
    relationshipId,
    sourceId,
    targetId,
    type: 'stranger',
    affection: 0,
    trust: 0,
    intimacy: 0,
    familiarity: 0,
    attraction: 0,
    conflict: 0,
    respect: 0,
    dependency: 0,
    tags: [],
    status: 'active',
    customMetrics: {},
  };
  return { ...base, ...overrides };
}

export interface CreateGameStateOptions {
  runId?: string;
  seed?: number;
  day?: number;
  time?: string;
  dailyProgressLimit?: number;
  currentLocationId?: string;
  status?: RunState['status'];
}

/** 创建最小但完整合法的 GameState（空角色/关系集合）。 */
export function createGameState(options: CreateGameStateOptions = {}): GameState {
  const day = options.day ?? 1;
  const time = options.time ?? '09:00';
  const currentLocationId = options.currentLocationId ?? 'loc_start';
  const seed = options.seed ?? 1;

  const run: RunState = {
    runId: options.runId ?? `run_${day.toString().padStart(3, '0')}`,
    startedAt: new Date().toISOString(),
    day,
    turn: 0,
    time,
    dailyProgress: 0,
    dailyProgressLimit: options.dailyProgressLimit ?? 12,
    currentLocationId,
    status: options.status ?? 'active',
  };

  const world: WorldState = {
    day,
    time,
    weekday: weekdayAfter('monday', day - 1),
    season: 'spring',
    weather: { type: 'clear', intensity: 0, temperature: 20, visibility: 100 },
    currentLocationId,
    locations: {
      [currentLocationId]: {
        locationId: currentLocationId,
        name: '起点',
        type: 'hub',
        tags: [],
        accessibility: 100,
        active: true,
        currentCharacters: [],
      },
    },
    publicEvents: [],
    activeEvents: [],
    worldFlags: {},
  };

  const state: GameState = {
    schemaVersion: '0.1.0',
    run,
    world,
    characters: {},
    relationships: {},
    flags: {},
    playerModel: {
      perceivedTraits: {},
      perceivedIntentions: {},
      behavioralPatterns: {},
      recentBehaviorPattern: [],
      reliability: 50,
      honesty: 50,
      caring: 50,
      confidence: 50,
      romanticInterest: 0,
      perceivedControl: 50,
    },
    memories: {
      records: {},
      shortTermIds: [],
      longTermIds: [],
      forgottenIds: [],
      lastConsolidatedDay: 0,
    },
    meta: {
      runCount: 1,
      completedRuns: 0,
      knowledge: {},
      memories: [],
      unlocks: [],
      achievements: [],
      endingsDiscovered: [],
      permanentModifiers: {},
    },
    rng: { seed, state: [seed], algorithm: 'xorshift128-placeholder' },
  };

  return gameStateSchema.parse(state);
}

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function weekdayAfter(start: (typeof WEEKDAYS)[number], offset: number): (typeof WEEKDAYS)[number] {
  const index = (WEEKDAYS.indexOf(start) + offset) % WEEKDAYS.length;
  return WEEKDAYS[index] ?? 'monday';
}

export interface GameStateValidation {
  success: boolean;
  issues: string[];
}

export function validateGameState(state: GameState): GameStateValidation {
  const parsed = gameStateSchema.safeParse(state);
  if (parsed.success) {
    return { success: true, issues: [] };
  }
  return {
    success: false,
    issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/** 应用 FinalStateDelta，返回新的 GameState；输入不被修改。 */
export function applyDelta(state: GameState, delta: FinalStateDelta): GameState {
  const parsed = finalStateDeltaSchema.parse(delta);
  const next = cloneGameState(state);

  if (parsed.run) {
    const run = parsed.run;
    if (run.day !== undefined) next.run.day = run.day;
    if (run.turn !== undefined) next.run.turn = run.turn;
    if (run.time !== undefined) next.run.time = run.time;
    if (run.dailyProgress !== undefined) next.run.dailyProgress = run.dailyProgress;
    if (run.currentEventId !== undefined) next.run.currentEventId = run.currentEventId;
    if (run.currentLocationId !== undefined) {
      next.run.currentLocationId = run.currentLocationId;
      next.world.currentLocationId = run.currentLocationId;
    }
    if (run.status !== undefined) next.run.status = run.status;
    // Run 与 World 的 day/time 保持同一权威数值。
    if (run.day !== undefined) next.world.day = run.day;
    if (run.time !== undefined) next.world.time = run.time;
  }

  if (parsed.characters) {
    for (const [characterId, characterDelta] of Object.entries(parsed.characters)) {
      const character = next.characters[characterId];
      if (!character) continue;
      applyMetricChanges(character.psychology, characterDelta.psychology, 0, 100);
      applyMetricChanges(character.emotion, characterDelta.emotion, 0, 100);
      if (characterDelta.emotion?.valence) {
        character.emotion.valence = clamp(characterDelta.emotion.valence.after, -100, 100);
      }
      applyMetricChanges(character.physical, characterDelta.physical, 0, 100);
      if (characterDelta.status !== undefined) character.status = characterDelta.status;
    }
  }

  if (parsed.relationships) {
    for (const [relationshipId, metricDeltas] of Object.entries(parsed.relationships)) {
      const relationship = next.relationships[relationshipId];
      if (!relationship) continue;
      for (const [metric, change] of Object.entries(metricDeltas)) {
        if (
          metric in relationship &&
          typeof relationship[metric as keyof RelationshipState] === 'number'
        ) {
          (relationship as unknown as Record<string, number>)[metric] = clamp(change.after, 0, 100);
        }
      }
    }
  }

  if (parsed.world) {
    if (parsed.world.weather) {
      next.world.weather = { ...next.world.weather, ...parsed.world.weather };
    }
    if (parsed.world.flagsPatch) {
      applyFlagsPatch((next.world.worldFlags ??= {}), parsed.world.flagsPatch);
    }
    if (parsed.world.currentLocationId !== undefined) {
      next.world.currentLocationId = parsed.world.currentLocationId;
      next.run.currentLocationId = parsed.world.currentLocationId;
    }
    if (parsed.world.time !== undefined) {
      next.world.time = parsed.world.time;
      next.run.time = parsed.world.time;
    }
  }

  if (parsed.flags) {
    applyFlagsPatch(next.flags, parsed.flags);
  }

  if (parsed.meta) {
    applyMetaPatch(next, parsed.meta);
  }

  // MemoryCandidate 是候选，不是最终写入；由 Memory Engine（Phase 6）确认后落库。
  return clampStateValues(next);
}

function applyMetricChanges<T extends object>(
  target: T,
  changes: Record<string, MetricChange> | undefined,
  min: number,
  max: number,
): void {
  if (!changes) return;
  const record = target as Record<string, unknown>;
  for (const [metric, change] of Object.entries(changes)) {
    if (metric in record && typeof record[metric] === 'number') {
      record[metric] = clamp(change.after, min, max);
    }
  }
}

function applyFlagsPatch(
  target: Record<string, boolean | number | string>,
  patch: FlagsPatch,
): void {
  for (const [key, value] of Object.entries(patch.set ?? {})) {
    target[key] = value;
  }
  for (const key of patch.unset ?? []) {
    delete target[key];
  }
}

function applyMetaPatch(state: GameState, patch: MetaPatch): void {
  for (const [id, knowledge] of Object.entries(patch.knowledge ?? {})) {
    state.meta.knowledge[id] = knowledge;
  }
  for (const memory of patch.memories ?? []) {
    if (!state.meta.memories.some((existing) => existing.id === memory.id)) {
      state.meta.memories.push(memory);
    }
  }
  appendUnique(state.meta.unlocks, patch.unlocks);
  appendUnique(state.meta.achievements, patch.achievements);
  appendUnique(state.meta.endingsDiscovered, patch.endingsDiscovered);
  for (const [key, value] of Object.entries(patch.permanentModifiers ?? {})) {
    state.meta.permanentModifiers[key] = value;
  }
}

function appendUnique(target: string[], additions: string[] | undefined): void {
  for (const value of additions ?? []) {
    if (!target.includes(value)) target.push(value);
  }
}

export interface GameStateDiff {
  run: Array<{ field: keyof RunState; before: unknown; after: unknown }>;
  characters: Record<string, Record<string, Record<string, MetricChange>>>;
  relationships: Record<string, Record<string, MetricChange>>;
  flags: FlagsPatch;
  memoryAdded: string[];
  memoryRemoved: string[];
}

/** 比较两个状态，输出可审计的差异。 */
export function diffGameStates(before: GameState, after: GameState): GameStateDiff {
  const diff: GameStateDiff = {
    run: [],
    characters: {},
    relationships: {},
    flags: { set: {}, unset: [] },
    memoryAdded: [],
    memoryRemoved: [],
  };

  for (const field of [
    'runId',
    'startedAt',
    'day',
    'turn',
    'time',
    'dailyProgress',
    'dailyProgressLimit',
    'currentEventId',
    'currentLocationId',
    'status',
  ] as const) {
    if (before.run[field] !== after.run[field]) {
      diff.run.push({ field, before: before.run[field], after: after.run[field] });
    }
  }

  for (const [id, afterRelationship] of Object.entries(after.relationships)) {
    const beforeRelationship = before.relationships[id];
    if (!beforeRelationship) continue;
    diff.relationships[id] = diffNumericObject(beforeRelationship, afterRelationship);
  }

  for (const [id, afterCharacter] of Object.entries(after.characters)) {
    const beforeCharacter = before.characters[id];
    if (!beforeCharacter) continue;
    const sections = ['personality', 'psychology', 'emotion', 'cognition', 'physical'] as const;
    for (const section of sections) {
      const sectionDiff = diffNumericObject(beforeCharacter[section], afterCharacter[section]);
      if (Object.keys(sectionDiff).length > 0) {
        (diff.characters[id] ??= {})[section] = sectionDiff;
      }
    }
  }

  const beforeFlags = before.flags;
  const afterFlags = after.flags;
  for (const [key, value] of Object.entries(afterFlags)) {
    if (beforeFlags[key] !== value) {
      (diff.flags.set ??= {})[key] = value;
    }
  }
  for (const key of Object.keys(beforeFlags)) {
    if (!(key in afterFlags)) {
      (diff.flags.unset ??= []).push(key);
    }
  }

  for (const id of Object.keys(after.memories.records)) {
    if (!(id in before.memories.records)) diff.memoryAdded.push(id);
  }
  for (const id of Object.keys(before.memories.records)) {
    if (!(id in after.memories.records)) diff.memoryRemoved.push(id);
  }

  return diff;
}

function diffNumericObject(before: object, after: object): Record<string, MetricChange> {
  const diff: Record<string, MetricChange> = {};
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  for (const key of keys) {
    const beforeValue = beforeRecord[key];
    const afterValue = afterRecord[key];
    if (
      typeof beforeValue === 'number' &&
      typeof afterValue === 'number' &&
      beforeValue !== afterValue
    ) {
      diff[key] = { before: beforeValue, after: afterValue, delta: afterValue - beforeValue };
    }
  }
  return diff;
}

export function withCharacter(state: GameState, character: CharacterState): GameState {
  const next = cloneGameState(state);
  next.characters[character.characterId] = character;
  return next;
}

export function withRelationship(state: GameState, relationship: RelationshipState): GameState {
  const next = cloneGameState(state);
  next.relationships[relationship.relationshipId] = relationship;
  return next;
}

export type {
  CharacterActivityState,
  CharacterState,
  FinalStateDelta,
  GameState,
  MemoryRecord,
  RelationshipState,
  RunState,
  WorldState,
};
