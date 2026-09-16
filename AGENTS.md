# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目定位

**AI GALGAME Framework**（tavern-gal）：一个以 SillyTavern 为可选 AI Runtime、以 GALGAME 选择式交互为表现形式、以 Game State 为核心、由 AI 动态叙事 + Roguelike 机制驱动的 AI 叙事游戏框架。

当前仓库处于**Completion Plan v1.1 已执行 + 2026-08 审计修复 + Life Engine P0/P0.5/P1/P2 已完成 + 双 Agent 视角管辖权（v1.6）已落地**阶段：权威架构由 `AI_GALGAME_Master_Design_v1.0.md` 定义（**注意：文件名保留 v1.0，内容版本已是 v1.6**，其 §11"Life Engine"中 P0 Transition、P0.5 Beat System、P1 Pending Intent 与 P2 Autonomous Event 已实现，P3–P5 为已定案未实现；§11.11 Beat System 定义了事件内连续叙事流（含 motive 思维链机制）），`COMPLETION_PLAN.md` 记录 Phase A–H 补全结果。Phase 0.5–12 与补全计划已落地并通过自动化验收，但部分组件曾"实现未接线"，已于 2026-08-21 审计中接线（见 `docs/review/doc-vs-impl-audit-2026-08-21.md`）。任何实现工作开始前，必须先读权威设计文档与开发计划，不要凭推测自行发明架构。

### 权威文档（唯一事实来源）

| 文档                                          | 内容                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_GALGAME_Master_Design_v1.0.md`            | **唯一权威设计基线（最优先读）**。对六份 v0.1 设计文档的分析综合与定案：设计哲学、核心玩法闭环、职责边界、领域模型/数据契约、分层架构、数据所有权、技术栈定案、验收标准。§11 Life Engine（Transition/Pending Intent/Autonomous Event/Micro Event/Relationship Narrative State/Event Scheduler）：P0 Transition、P0.5 Beat System、P1 Pending Intent 与 P2 Autonomous Event **已实现**，P3–P5 **已设计未实现**。 |
| `DEVELOPMENT_PLAN.md`                         | **可执行的分阶段开发计划**。Phase 0–12，每阶段含目标/验收标准/任务清单/测试/验证命令。执行开发时按此推进。                                                                                                                                                                                                                                                                                                      |
| `EVENT_LIFE_PLAN.md`                          | Life Engine（Master Design §11）的 P0–P5 实现计划；P0/P0.5/P1/P2 已完成，P3–P5 待做。                                                                                                                                                                                                                                                                                                                           |
| `BEAT_SYSTEM_DESIGN.md`                       | **P0.5 唯一实现依据**：事件内连续叙事流的契约/接口/类/开发计划（T1–T8）。                                                                                                                                                                                                                                                                                                                                       |
| `docs/review/known-issues.md`                 | 已确认问题与待办清单（含真实 LLM 联调记录），动手前先查此文件避免重复劳动。                                                                                                                                                                                                                                                                                                                                     |
| `docs/review/doc-vs-impl-audit-2026-08-21.md` | 文档 vs 实现差异审计与修复记录。                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/design-history/`                        | 六份 v0.1 设计文档归档区，仅供追溯，**不以之为实现依据**。                                                                                                                                                                                                                                                                                                                                                      |

文档均为中文，正文技术术语请沿用原文（如 `StateResolver`、`Daily Progress`、`Memory Candidate`）。

## 常用命令

**技术栈已定案：TypeScript + React + Zod**（见 Master Design §8）。pnpm TS monorepo 已就绪，Phase 1 Schema 已冻结：

```bash
pnpm install                    # 安装依赖
pnpm build                      # 构建全部包（tsup，拓扑顺序）
pnpm test                       # 全部测试（Vitest workspace，每个包独立项目）
pnpm typecheck                  # 逐包类型检查（tsc --noEmit）
pnpm lint                       # ESLint（flat config）+ Prettier 检查（--max-warnings=0）
pnpm format                     # Prettier 自动格式化
pnpm --filter @ag/<pkg> test    # 只跑某包测试
pnpm vitest run <path/to/x.test.ts>   # 只跑单个测试文件（根目录执行，按路径过滤进对应项目）
```

注意：各包测试经 `pretest` 会先构建被依赖的兄弟包（如 `@ag/schemas`），测试 import 的是 `dist` 产物——fresh checkout 或改了上游包后先 `pnpm build` 再跑测试。

仓库布局：`packages/` 为 `@ag/*` 库（schemas → core → world/memory/context/narrative/option/character/persistence/runtime），LLM 与 SillyTavern 适配器为 `@ag/llm` 与 `@ag/st-adapter`（目录 `packages/adapters/{llm,sillytavern}`）；`apps/` 为 player（React 玩家 UI）/ designer（设计器）/ devtools（仿真·调试·真实对局记录）；`projects/`、`saves/` 存放示例 Project 与运行时存档。

仓库已初始化 git（当前分支 `main`，并已推送 `origin/main`）。阶段改动请继续以 git commit 追溯。

### 真实 LLM 验证 / 仿真 CLI（`ag-devtools`）

`apps/devtools` 构建后提供 CLI（`node apps/devtools/dist/cli.js <cmd>`；`@ag/devtools` 包内即 bin 名 `ag-devtools`）。Life Engine / Beat System 的验收惯例是真实 LLM 长对话复验：

```bash
# Provider 经 LLM_* 环境变量配置（packages/adapters/llm/src/provider-config.ts）
LLM_PROVIDER=openai-compatible \        # openai | anthropic | openai-compatible
LLM_BASE_URL=https://api.deepseek.com \
LLM_MODEL=deepseek-chat \
LLM_API_KEY=sk-xxx \
node apps/devtools/dist/cli.js live-play --turns 20 --out playthrough.md   # 完整对局 Markdown 记录

node apps/devtools/dist/cli.js live-verify --turns 30 --seed 20260821      # 无 LLM 时确定性仿真复验
node apps/devtools/dist/cli.js acceptance                                   # 自动化 V1 验收
node apps/devtools/dist/cli.js simulate --runs 100 [--seed N]               # 纯引擎仿真（不接 LLM）
```

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
- **Phase 7 已完成（LLM Gateway 落地）**：真实 Provider 适配器、重试/成本与 Scenario+Options 合并调用。
- **Phase 8 已完成（SillyTavern Adapter）**：Card/WorldBook/Context Bridge/Extension/Compiler。
- **Phase 9 已完成（Minimal Play UI）**：Runtime 编排 + Application API + React Player。
- **Phase 10 已完成（Designer Mode）**：最小设计器 + Project round-trip + Design→Play。
- **Phase 11 已完成（Simulation / Debug）**：devtools CLI、统计报告、Turn Debugger、Inspectors、Golden/Replay 与 Memory 修剪。
- **Phase 12 已完成（Presentation Layer）**：立绘/背景、打字机、CG 与音频占位。注意：立绘/背景组件支持 `assets` 真图但 Player 当前未传 src（CSS 渐变占位），音频面板为 disabled 占位。
- **Phase 11 注意事项**：`pruneMemories` 曾只接在 devtools 仿真器，2026-08-21 起已接入 `GameRuntime` 主路径（`memoryPruneLimit` 可配，默认 100）。
- **Completion Plan 已执行**：二次结算、PlayerModel 更新、记忆触发、Bad End→Meta Progression、LLM 软多样性、一致性检查、Context Cache、天气/日历/NPC 日程、Project Policy 运行时、设计器/校准/资源接口与自动化 V1 验收均已完成。
- **2026-08-21 审计接线修复**：此前"实现未接线"的组件已接入生产路径——`ContextCache`（含 stable summary 进 system prompt）、检索强化 `reinforceMemoryRecord`（startTurn 检索后强化）、`pruneMemories`（chooseOption 后修剪）、一致性规则 `consistency.forbiddenTopics/allowedCharacters`（RuntimeConfig 注入 Scenario+Reaction）、`llmMaxAttempts` 可配置（原写死 1）。详见 `docs/review/doc-vs-impl-audit-2026-08-21.md`。
- **2026-09-15/16 双 Agent 视角管辖权（Master Design v1.6）+ #16 修复**：生成端重构为 PlayerAgent（玩家第一人称「我」叙事+选项）/ CharacterAgent（文段拍+反应+过渡，角色内心只进 motive）门面（`packages/narrative/src/agents/`，内部复用既有生成器，引擎仍独占世界真相）；#16 POV 人称错误修复，真实 LLM 复验四项 POV 指标全过；#16 遗留观察（拍间台词级去重 `EventFlow.recentDialogues` + 反应场景 grounding `ReactionGeneratorOptions.scene`）同日修复，第三轮 12 Turn 复验 12/12 场景连贯、台词重复 0、stress 45→43。验证记录 `docs/review/dual-agent-*-verify*.md`。
- **仍未实现（设计已定案）**：Master Design §11 Life Engine（P0 Transition、P0.5 Beat System 与 P1 Pending Intent 及 P2 Autonomous Event 已完成——P1/P2 于 2026-09-10 落地：意图契约/引擎/触发接线 + 自主发起判定/事件合成/[自主发起] 叙事指令；真实 LLM 复验 P1 12 Turn 11 意图 10 completed、P2 种子化场景角色主动出现并提及前一天的事；known-issues #15 已于同日第四轮 DeepSeek V4 Flash 复验关闭——stress 45→43 不归零、文段拍 100% llm、high/mid 变奏成立；P3–P5 待做）；Gemini/Local Provider；HTTP Application API；PNG 卡导入；设计器多数编辑器 UI（仅 7 字段表单）；真实立绘/音频资源；成本真实 token 计量。
- **下一步**：Life Engine P3 Micro Events（实施计划 S1 层级确认→S2 Micro 池→S3 调度接入→S4 叙事短路→S5 记忆与验收已定；P1/P2 意图与自主发起管线就绪，`importance` 字段已提前落地可复用，P3 前置修复已于 2026-09-16 完成）；随后 P4/P5 与部署层 HTTP/PNG 卡/音频资源接入。注意：DeepSeek V4 Flash 等推理模型需 `LLM_THINKING=disabled`（见 `@ag/llm` provider-config）。

验收基线（Phase 2 原则）：**核心玩法的纯文本闭环能连续跑几十个 Turn 而不破坏 GameState，且不接任何 LLM，才算 Game Core 成立。**
