// @ag/core —— Pure Game Core + State Resolver（Phase 3）。
// 纯确定性规则：GameState 工厂 / Progress / Modifier Resolver / Turn 事务 / Rule / Ending / Simulator。
// 本阶段不依赖任何 LLM 或外部 Runtime；RNG 以 Port 形式注入。
export * from './game-state.js';
export * from './progress-engine.js';
export * from './rule-engine.js';
export * from './ending-engine.js';
export * from './rng.js';
export * from './state-resolver.js';
export * from './turn.js';
export * from './simulate.js';
export * from './secondary-resolution.js';
export * from './player-model-update.js';
export * from './meta-progression.js';
export * from './flow-controller.js';
