// @ag/core —— Pure Game Core（Phase 2）。
// 纯确定性规则：GameState 工厂 / Progress / Turn 事务 / Rule / Ending / Simulator。
// 本阶段不依赖任何 LLM、RNG 或外部 Runtime。
export * from './game-state.js';
export * from './progress-engine.js';
export * from './rule-engine.js';
export * from './ending-engine.js';
export * from './turn.js';
export * from './simulate.js';
