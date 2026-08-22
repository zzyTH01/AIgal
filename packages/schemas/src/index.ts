// @ag/schemas —— 数据契约单一事实来源（TS 类型 + Zod 运行时校验 + JSON Schema）。
// 所有跨包数据结构必须从这里导出，禁止在其他包重新发明字段。
export const SCHEMA_VERSION = '0.1.0';

export * from './primitives.js';
export * from './character.js';
export * from './relationship.js';
export * from './world.js';
export * from './player-model.js';
export * from './memory.js';
export * from './meta.js';
export * from './rng.js';
export * from './game-state.js';
export * from './option.js';
export * from './state-delta.js';
export * from './event.js';
export * from './turn-result.js';
export * from './transition.js';
export * from './beat.js';
export * from './context.js';
export * from './save.js';
export * from './character-definition.js';
export * from './project.js';
export * from './json-schema.js';
