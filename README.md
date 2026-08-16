# AI GALGAME Framework (tavern-gal)

一个以 **SillyTavern** 为可选 AI Runtime、以 GALGAME 式选择交互为表现形式、以 **Game State** 为核心、由 **AI 动态叙事 + Roguelike 机制**驱动的 AI 叙事游戏框架。

> 固定规则，而不是固定剧情；玩家选择的是行为，而不是台词；AI 负责表现，规则引擎负责真实状态。

## 文档

- **`AI_GALGAME_Master_Design_v1.0.md`** — 唯一权威设计基线（设计哲学、核心闭环、领域模型、分层架构、验收标准）
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

## 仓库结构

```text
packages/   @ag/* 库（schemas → core → world/character/option/memory/context → narrative → runtime → adapters）
apps/       应用（player 玩家 UI / designer 设计器 / devtools 模拟与调试）
projects/   示例游戏 Project 包
saves/      运行时存档输出
docs/       设计文档
```
