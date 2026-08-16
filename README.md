# AI GALGAME Framework (tavern-gal)

一个以 **SillyTavern** 为可选 AI Runtime、以 GALGAME 式选择交互为表现形式、以 **Game State** 为核心、由 **AI 动态叙事 + Roguelike 机制**驱动的 AI 叙事游戏框架。

> 固定规则，而不是固定剧情；玩家选择的是行为，而不是台词；AI 负责表现，规则引擎负责真实状态。

## 文档

- **`AI_GALGAME_Master_Design_v1.0.md`** — 唯一权威设计基线（当前文档版本 v1.1；设计哲学、核心闭环、领域模型、分层架构、验收标准）
- **`DEVELOPMENT_PLAN.md`** — 可执行的分阶段开发计划（Phase 0.5–12）
- `docs/design-history/` — 早期设计文档归档

## 快速开始

```bash
# 依赖安装（monorepo：packages/* + apps/*）
pnpm install

# 构建全部包（拓扑顺序）
pnpm build

# 测试 / 类型检查 / Lint
pnpm test
pnpm typecheck
pnpm lint
```

## 当前进度

- ✅ Phase 0 — 设计冻结
- ✅ Phase 0.5 — 工程初始化（pnpm + TypeScript monorepo）
- ✅ Phase 1 — 数据契约冻结：`@ag/schemas` 已落地 TS 类型 + Zod 运行时校验 + JSON Schema（Draft 2020-12），全部 Schema 从 Zod 同源生成
- ✅ Phase 2 — Pure Game Core：`@ag/core` 已具备 GameState 工厂 / applyDelta / diff / Progress / Turn 事务 / Rule / Ending / 50+ Turn 模拟器
- ✅ Phase 3 — State Resolver：Modifier 链、非线性反馈、重复反馈、Risk 分支、非法 AI 值 fallback
- ✅ Phase 4 — Event + RNG：xorshift128 可复现 RNG、EventPool、权重/条件/冷却/稀有度事件选择、WorldTick 骨架
- ✅ Phase 5 — Narrative / Option Engine：LLM Port + TestProvider、Scenario/Option/Reaction 生成、非法输出 Retry→Fallback
- ✅ Phase 6 — Memory / Context：记忆全生命周期、ContextBuilder + ContextBudget、不同认知 Profile 不同 Context
- ✅ Phase 7 — LLM Gateway：OpenAI / Anthropic / OpenAI-Compatible 适配器、重试/超时/成本日志、Scenario+Options 合并调用
- ✅ Phase 8 — SillyTavern Adapter：Character Card V2 / World Book / Context Bridge / Extension / Character Compiler
- ✅ Phase 9 — Minimal Play UI：`@ag/runtime` 编排 + Application API + React Player（无输入框）
- ⏭️ 下一步 — Phase 10：Designer Mode（角色/世界/规则设计器）

## 仓库结构

```text
packages/   @ag/* 库（schemas → core → world/character/option/memory/context → narrative → runtime → adapters）
apps/       应用（player 玩家 UI / designer 设计器 / devtools 模拟与调试）
projects/   示例游戏 Project 包
saves/      运行时存档输出
docs/       设计文档
```
