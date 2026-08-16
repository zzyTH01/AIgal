import type { GameState } from '@ag/schemas';
import { cloneGameState } from './game-state.js';

export interface NumericCondition {
  min?: number;
  max?: number;
}

export type ConditionValue = boolean | number | string | NumericCondition;
export type ConditionSet = Record<string, ConditionValue>;

/**
 * 读取条件路径的值。
 * 支持：
 * - `run.<field>` / `world.<field>`
 * - `flags.<key>` / 裸 flag key
 * - `relationship.<relationshipId>.<metric>` / `relationship.<metric>`（聚合：任一关系满足）
 * - `character.<characterId>.<section>.<metric>` / `character.<section>.<metric>`（聚合：任一角色满足）
 */
export function resolveConditionValues(state: GameState, key: string): unknown[] {
  if (key.startsWith('run.')) {
    return [readPath(state.run, key.slice('run.'.length))];
  }
  if (key.startsWith('world.')) {
    return [readPath(state.world, key.slice('world.'.length))];
  }
  if (key.startsWith('flags.')) {
    return [state.flags[key.slice('flags.'.length)]];
  }
  if (key.startsWith('relationship.')) {
    const rest = key.slice('relationship.'.length);
    const [head, ...tail] = rest.split('.');
    if (head && head in state.relationships) {
      return [readPath(state.relationships[head], tail.join('.'))];
    }
    const metric = [head, ...tail].join('.');
    return Object.values(state.relationships).map((relationship) => readPath(relationship, metric));
  }
  if (key.startsWith('character.')) {
    const rest = key.slice('character.'.length);
    const [head, ...tail] = rest.split('.');
    if (head && head in state.characters) {
      return [readPath(state.characters[head], tail.join('.'))];
    }
    const metric = [head, ...tail].join('.');
    return Object.values(state.characters).map((character) => readPath(character, metric));
  }
  return [state.flags[key]];
}

function readPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function evaluateConditionValue(actual: unknown, condition: ConditionValue): boolean {
  if (actual === undefined) return false;
  if (isNumericCondition(condition)) {
    if (typeof actual !== 'number') return false;
    if (condition.min !== undefined && actual < condition.min) return false;
    if (condition.max !== undefined && actual > condition.max) return false;
    return true;
  }
  return actual === condition;
}

export function evaluateCondition(
  state: GameState,
  key: string,
  condition: ConditionValue,
): boolean {
  // 聚合路径语义：任一匹配实体满足即通过。
  return resolveConditionValues(state, key).some((actual) =>
    evaluateConditionValue(actual, condition),
  );
}

export function evaluateConditions(state: GameState, conditions: ConditionSet): boolean {
  return Object.entries(conditions).every(([key, condition]) =>
    evaluateCondition(state, key, condition),
  );
}

export function isNumericCondition(value: ConditionValue): value is NumericCondition {
  return typeof value === 'object' && value !== null;
}

export function getFlag(state: GameState, key: string): boolean | number | string | undefined {
  return state.flags[key];
}

export function setFlag(
  state: GameState,
  key: string,
  value: boolean | number | string,
): GameState {
  const next = cloneGameState(state);
  next.flags[key] = value;
  return next;
}

export function unsetFlag(state: GameState, key: string): GameState {
  const next = cloneGameState(state);
  delete next.flags[key];
  return next;
}
