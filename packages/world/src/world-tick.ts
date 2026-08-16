import type { GameState } from '@ag/schemas';
import { cloneGameState, validateGameState } from '@ag/core';

/** World Engine 骨架：时间/天气/地点/NPC 位置/公共事件推进的统一端口。 */
export interface WorldTick {
  tick(state: GameState): GameState;
}

/**
 * Phase 4 默认 WorldTick：
 * 只做 Run → World 的权威字段同步（day/time/currentLocation），
 * 天气演化、NPC 位置与公共事件推进由后续 Phase 在实现中扩展。
 */
export function tickWorld(state: GameState): GameState {
  const next = cloneGameState(state);
  next.world.day = next.run.day;
  next.world.time = next.run.time;
  next.world.currentLocationId = next.run.currentLocationId;
  return next;
}

export const defaultWorldTick: WorldTick = Object.freeze({
  tick(state: GameState): GameState {
    const next = tickWorld(state);
    const validation = validateGameState(next);
    if (!validation.success) {
      throw new Error(`WorldTick produced invalid GameState: ${validation.issues.join('; ')}`);
    }
    return next;
  },
});
