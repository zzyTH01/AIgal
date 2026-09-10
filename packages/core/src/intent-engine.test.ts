import { describe, expect, it } from 'vitest';
import { createGameState } from './game-state.js';
import type { GameState } from '@ag/schemas';
import {
  cancelIntent,
  completeIntent,
  expireStaleIntents,
  formPendingIntent,
  markIntentTriggered,
  matchIntentContext,
  pickTopIntent,
  type IntentCandidate,
} from './intent-engine.js';

function makeState(): GameState {
  const state = createGameState({ runId: 'run_intent', seed: 42, day: 1, time: '09:00' });
  state.world.currentLocationId = 'loc_library';
  return state;
}

const candidate: IntentCandidate = {
  characterId: 'char_a',
  summary: '想继续向玩家讲述真实历史',
  sourceEventId: 'event_history',
  sourceTurnId: 'run_intent/day_001/turn_001',
  sourceMotive: '他愿意听，我想继续',
  priority: 70,
  conditions: {},
  preferredLocations: ['loc_library'],
  preferredTimeRange: { from: '09:00', to: '18:00' },
  latestTriggerDay: 3,
};

describe('intent-engine 生命周期', () => {
  it('formPendingIntent 创建 waiting 意图并写入 pendingIntents', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    const intents = Object.values(state.pendingIntents?.intents ?? {});
    expect(intents).toHaveLength(1);
    expect(intents[0]?.status).toBe('waiting');
    expect(intents[0]?.id).toBe('intent_001');
    expect(intents[0]?.latestTriggerDay).toBe(3);
  });

  it('matchIntentContext 校验地点/时间段/条件/过期', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    const intent = Object.values(state.pendingIntents!.intents)[0]!;

    // 地点匹配 + 时间在范围内
    expect(
      matchIntentContext(intent, { day: 2, time: '15:00', locationId: 'loc_library', state }),
    ).toBe(true);
    // 地点不匹配
    expect(
      matchIntentContext(intent, { day: 2, time: '15:00', locationId: 'loc_cafeteria', state }),
    ).toBe(false);
    // 时间早于偏好区间
    expect(
      matchIntentContext(intent, { day: 2, time: '08:00', locationId: 'loc_library', state }),
    ).toBe(false);
    // 超过最晚触发日
    expect(
      matchIntentContext(intent, { day: 4, time: '15:00', locationId: 'loc_library', state }),
    ).toBe(false);
  });

  it('matchIntentContext 支持条件（trust 阈值）', () => {
    let state = makeState();
    state = formPendingIntent(state, {
      ...candidate,
      conditions: { 'relationship.trust': { min: 50 } },
    });
    const intent = Object.values(state.pendingIntents!.intents)[0]!;
    // trust 默认 0 → 不满足
    expect(
      matchIntentContext(intent, { day: 2, time: '15:00', locationId: 'loc_library', state }),
    ).toBe(false);
    // 提升 trust 后满足
    state.relationships['rel_player_char_a'] = {
      relationshipId: 'rel_player_char_a',
      sourceId: 'player',
      targetId: 'char_a',
      type: 'friend',
      affection: 10,
      trust: 60,
      intimacy: 0,
      familiarity: 20,
      attraction: 0,
      conflict: 0,
      respect: 30,
      dependency: 0,
      tags: [],
      status: 'active',
      customMetrics: {},
    };
    expect(
      matchIntentContext(intent, { day: 2, time: '15:00', locationId: 'loc_library', state }),
    ).toBe(true);
  });

  it('触发→完成 全生命周期', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    state = markIntentTriggered(state, 'intent_001', 'event_intent_001');
    expect(state.pendingIntents!.intents['intent_001']?.status).toBe('triggered');
    expect(state.pendingIntents!.intents['intent_001']?.triggeredEventId).toBe('event_intent_001');

    state = completeIntent(state, 'intent_001');
    expect(state.pendingIntents!.intents['intent_001']?.status).toBe('completed');
    expect(state.pendingIntents!.intents['intent_001']?.resolvedAt).toBeDefined();
  });

  it('取消与过期', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    state = cancelIntent(state, 'intent_001');
    expect(state.pendingIntents!.intents['intent_001']?.status).toBe('cancelled');

    // 过期：latestTriggerDay=3，当前 day=4
    let state2 = makeState();
    state2.run.day = 4;
    state2 = formPendingIntent(state2, { ...candidate, latestTriggerDay: 3 });
    state2 = expireStaleIntents(state2);
    expect(state2.pendingIntents!.intents['intent_001']?.status).toBe('expired');
  });

  it('pickTopIntent 返回最高优先级的匹配 waiting 意图', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    state = formPendingIntent(state, {
      ...candidate,
      summary: '想送玩家一本书',
      priority: 90,
      preferredLocations: ['loc_library'],
    });
    const picked = pickTopIntent(state, { day: 2, time: '15:00', locationId: 'loc_library' });
    expect(picked?.summary).toBe('想送玩家一本书');
  });

  it('重复 summary 的 waiting 意图不重复产生（去重）', () => {
    let state = makeState();
    state = formPendingIntent(state, candidate);
    state = formPendingIntent(state, candidate);
    expect(Object.keys(state.pendingIntents!.intents)).toHaveLength(1);
  });
});
