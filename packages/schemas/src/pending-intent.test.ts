import { describe, expect, it } from 'vitest';
import { gameStateSchema } from './game-state.js';
import { makeGameState } from './test-data.js';
import { pendingIntentSchema, type PendingIntent } from './pending-intent.js';

export function makePendingIntent(overrides: Partial<PendingIntent> = {}): PendingIntent {
  return {
    id: 'intent_001',
    characterId: 'char_mio',
    summary: '想继续向玩家讲述真实历史',
    sourceEventId: 'event_history_talk',
    sourceTurnId: 'run_017/day_001/turn_003',
    sourceMotive: '他愿意听我说这些，我想继续',
    priority: 70,
    conditions: {},
    preferredLocations: ['loc_library'],
    preferredTimeRange: { from: '13:00', to: '18:00' },
    latestTriggerDay: 3,
    createdAt: { day: 1, time: '17:30' },
    status: 'waiting',
    ...overrides,
  };
}

describe('pendingIntentSchema', () => {
  it('parses a full pending intent round-trip', () => {
    const intent = makePendingIntent();
    expect(pendingIntentSchema.parse(intent)).toEqual(intent);
  });

  it('rejects unknown status and out-of-range priority', () => {
    expect(() => pendingIntentSchema.parse({ ...makePendingIntent(), status: 'paused' })).toThrow();
    expect(() => pendingIntentSchema.parse(makePendingIntent({ priority: 150 }))).toThrow();
    expect(() => pendingIntentSchema.parse(makePendingIntent({ summary: '' }))).toThrow();
  });

  it('allows minimal intent with only required fields', () => {
    const intent = makePendingIntent({
      sourceEventId: undefined,
      sourceTurnId: undefined,
      sourceMotive: undefined,
      preferredTimeRange: undefined,
    });
    expect(pendingIntentSchema.parse(intent)).toBeDefined();
  });
});

describe('pendingIntentState + GameState integration', () => {
  it('parses GameState with pendingIntents present', () => {
    const base = gameStateSchema.parse({
      ...makeGameState(),
      pendingIntents: {
        intents: { intent_001: makePendingIntent() },
      },
    });
    expect(base.pendingIntents?.intents['intent_001']?.status).toBe('waiting');
  });

  it('parses GameState without pendingIntents (旧存档兼容)', () => {
    const base = gameStateSchema.parse(makeGameState());
    expect(base.pendingIntents).toBeUndefined();
  });
});
