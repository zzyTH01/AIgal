# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

**AI GALGAME Framework**（tavern-gal）：一个以 SillyTavern 为可选 AI Runtime、以 GALGAME 选择式交互为表现形式、以 Game State 为核心、由 AI 动态叙事 + Roguelike 机制驱动的 AI 叙事游戏框架。

当前仓库处于**Phase 7 已完成（LLM Gateway 落地）**阶段：权威架构由两份设计文档定义（见下），工程为 pnpm + TypeScript monorepo；纯规则闭环、记忆/上下文、LLM 生成链路与可配置真实 Provider 网关均已就绪。任何实现工作开始前，必须先读权威设计文档与开发计划，不要凭推测自行发明架构。

### 权威文档（唯一事实来源）

| 文档                               | 内容                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_GALGAME_Master_Design_v1.0.md` | **唯一权威设计基线（最优先读）**。对六份 v0.1 设计文档的分析综合与定案：设计哲学、核心玩法闭环、职责边界、领域模型/数据契约、分层架构、数据所有权、技术栈定案、验收标准。 |
| `DEVELOPMENT_PLAN.md`              | **可执行的分阶段开发计划**。Phase 0–12，每阶段含目标/验收标准/任务清单/测试/验证命令。执行开发时按此推进。                                                                |
| `docs/design-history/`             | 六份 v0.1 设计文档归档区，仅供追溯，**不以之为实现依据**。                                                                                                                |

文档均为中文，正文技术术语请沿用原文（如 `StateResolver`、`Daily Progress`、`Memory Candidate`）。

## 常用命令

**技术栈已定案：TypeScript + React + Zod**（见 Master Design §8）。pnpm TS monorepo 已就绪，Phase 1 Schema 已冻结：

```bash
pnpm install                    # 安装依赖
pnpm build                      # 构建全部包（tsup，拓扑顺序）
pnpm test                       # 全部测试（Vitest workspace，每个包独立项目）
pnpm typecheck                  # 逐包类型检查（tsc --noEmit）
pnpm lint                       # ESLint（flat config）+ Prettier 检查
pnpm format                     # Prettier 自动格式化
pnpm --filter @ag/<pkg> test    # 只跑某包测试
```

仓库已初始化 git（当前分支 `main`，并已推送 `origin/main`）。阶段改动请继续以 git commit 追溯。

## 核心架构（跨文档的"大图"）

### 核心设计哲学（六句话，决定一切取舍）

1. **固定规则，而不是固定剧情。** 不写固定剧情树；剧情是"状态演化 + AI 生成 + RNG"的结果。
2. **玩家选择的是行为，而不是台词。** Option 是结构化 Behavior Object，不是字符串。
3. **AI 负责表现，规则引擎负责真实状态。** LLM 只"提出"，`StateResolver` 才"确认"最终数值。
4. **角色记住什么，决定角色如何理解现在。** 记忆经 Formation/Decay/Retrieval 后才进 Context。
5. **失败不是终点，而是下一次 Run 的信息。** Bad End → Punishment → Meta Progression。
6. **SillyTavern 是 Runtime，不是游戏本体。** 它是可替换的 Adapter。

### 时间结构

```
Run ── Day ── Event/Scene ── Turn ── Player Choice
```

**Turn 是最小执行单位，定义为"原子叙事事务（Atomic Narrative Transaction）"**：读取状态 → 生成情境与选项 → 玩家选择 → 规则结算 → AI 生成反应 → 二次结算 → 记忆/上下文更新 → Day/Ending 检查 → 原子提交存档 → 下一 Turn。任何一步失败则 Rollback 到 Turn 前状态。

### AI 与确定性引擎的职责边界（最重要的架构原则）

- **AI 负责**：场景描述、NPC 语言/反应、动态事件、候选行为选项、情绪/意图的结构化判断、Memory Candidate。
- **游戏引擎必须负责**：Day/Time、Daily Progress、Affection/Trust/Intimacy 等最终数值、Flags、Ending、RNG、Save、Memory 最终写入、数值上下限与合法性校验、Rollback。

> **"AI 可以提出结果，但 Game Engine 才能确认结果。"** AI 返回 `affection_change: 5000` 这类非法值必须被忽略并改用规则重算。AI 输出一律"双通道"：Natural Language 给玩家 + Structured 数据给引擎。

### 分层架构（Hexagonal / Ports & Adapters）

```
Experience（Player UI / Designer UI）
  → Application（Turn Orchestrator 及游戏/叙事/记忆服务）
    → Core（GameState、Rules、StateResolver、Ending、Schemas —— 不依赖任何外部 runtime）
      ← Adapters（SillyTavern、LLM Providers、File/SQLite、Web/Desktop）
```

依赖单向：UI → Application → Core → 外接 Adapter。**禁止 `GameCore → SillyTavern`。** UI 不直接改 GameState，必须走 Application API（`POST /turn/choice` 之类）。

### 数据所有权（每个核心状态只有一条权威写入路径）

| 数据            | 权威模块            |
| --------------- | ------------------- |
| Day/Time        | Time Engine         |
| Daily Progress  | Progress Engine     |
| Affection/Trust | State Resolver      |
| Relationship    | Relationship Engine |
| World State     | World Engine        |
| Memory          | Memory Engine       |
| RNG             | RNG Service         |
| Ending          | Ending Engine       |
| Save            | Persistence         |
| LLM Context     | Context Builder     |

### GameState 根结构

```typescript
GameState = {
  schemaVersion,
  run: RunState,
  world: WorldState,
  characters: Record<CharacterId, CharacterState>,
  relationships: Record<RelationshipId, RelationshipState>,
  flags,
  playerModel,
  memories: MemoryState,
  meta: MetaState,
  rng: RNGState,
};
```

CharacterState = identity / personality / psychology / emotion / cognition / physical / activity / status。`memoryCapacity` 是**角色的抽象认知能力**，不是 LLM 真实 Context Window。`PlayerModel` 是"角色对玩家的主观认知"，不同角色可以对同一玩家形成不同判断。**原则：状态值（`affection=63`）与历史事件（`AffectionChanged{...}`）分离。**

### Option 系统

Option 是 Behavior Object：`presentation`（玩家看到的语言）+ `behavior`（actions/intent/tone/risk）+ `gameplay`（progress）+ `effects`（**只是 base 倾向，非最终结果**）+ `conditions` + `generation`。

- **两阶段生成**：先 `Option Planning`（定行为类型，如 `support/low risk`），再 `Option Realization`（转成自然语言）。**Gameplay Logic 与 Surface Language 分离。**
- **最终结算**：`ΔX = Base × PersonalityModifier × RelationshipModifier × ContextModifier × EmotionModifier`，再加 Clamp、非线性衰减（防刷好感）、重复行为反馈、风险。
- **多样性约束**：每轮至少覆盖 主动/保守/社交关系/风险 四类，避免四个同类选项。

### Memory 与 Context 是两套系统

- **Memory**：角色"记得什么"。结构化 `MemoryRecord`（importance/emotionalIntensity/strength/type 等），有 Encoding→Decay→Retrieval→Reinforcement→Consolidation 生命周期，衰减用 `S(t)=S₀e^(−λt)`，回忆会强化记忆。
- **Context**：这一轮 AI "应该看到什么"。由 Context Builder 按角色认知能力（Context Budget）挑选 Top-K 记忆 + 当前状态组装。LLM 从不读完整历史。

### 技术栈现状（已定案）

**技术栈已定案：TypeScript + React + Zod + JSON Schema（Draft 2020-12）**，`packages/schemas/schemas/` 是 JSON Schema 数据契约单一事实来源目录（Master Design §4.12、§8）。Python 脚手架已在 Phase 0.5 移除，当前为 pnpm TS monorepo。

## 当前实现状态

- **Phase 0.5 已完成**：pnpm TS monorepo 就绪，15 个包/应用骨架 + `packages/schemas` 独立构建/测试/类型检查全部通过。
- **Phase 1 已完成（数据契约冻结）**：`@ag/schemas` 已落地全部 TS 类型 + Zod + JSON Schema（Draft 2020-12），由 Zod 同源生成。
- **Phase 2 已完成（Pure Game Core）**：`@ag/core` 已实现 GameState 工厂/applyDelta/diff、ProgressEngine、RuleEngine、EndingEngine、Turn 事务与 `simulateNTurns`。
- **Phase 3 已完成（State Resolver）**：`resolveChoice(state, option, rng)` 实现 `BaseDelta → Modifier 链 → FinalDelta`。
- **Phase 4 已完成（Event + RNG）**：`@ag/world` 已实现可复现 RNG、EventPool、事件选择与 WorldTick；事件触发接线已落地并测试。
- **Phase 5 已完成（Narrative / Option Engine）**：LLM Port/TestProvider、Option Planner/Validator/Renderer、Scenario/Reaction 生成与 Retry→Fallback 链路。
- **Phase 6 已完成（Memory / Context）**：记忆全生命周期 + ContextBuilder/Budget。
- **Phase 7 已完成（LLM Gateway 落地）**：`@ag/llm` 实现 OpenAI/Anthropic/OpenAI-Compatible 适配器、Provider 注册表、重试/超时/退避、错误分类、Token 成本记录、ModelContext→请求转换与结构化校验入口；`@ag/narrative` 已把 Scenario+Options 合并为 1 次调用（Turn 3→2）。
- **下一阶段**：Phase 8 SillyTavern Adapter（见 `DEVELOPMENT_PLAN.md` §11）——Character Card / World Book / Context Bridge / Character Compiler。

验收基线（Phase 2 原则）：**核心玩法的纯文本闭环能连续跑几十个 Turn 而不破坏 GameState，且不接任何 LLM，才算 Game Core 成立。**
