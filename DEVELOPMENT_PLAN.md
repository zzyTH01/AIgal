# AI GALGAME Framework
## 开发计划 Development Plan v2.1

> 版本：v2.1 ｜ 依据：`AI_GALGAME_Master_Design_v1.0.md`（唯一权威设计基线，当前文档版本 v1.2）
>
> 本计划是**可执行的分阶段开发安排**。Claude Code（或任何开发执行者）应按阶段顺序推进：每阶段有明确目标、验收标准、任务清单、测试要求与验证命令，**验收通过后才进入下一阶段**。

---

# 0. 计划总览

## 0.1 阶段全景图

```text
Phase 0   设计冻结（已完成）──────────────────────┐
Phase 0.5 工程初始化（TS Monorepo）               │
Phase 1   数据契约冻结（Schema 先行）◄────────────┘ 一切的地基
Phase 2   Pure Game Core（纯规则，无 LLM）
Phase 3   State Resolver（Modifier 引擎）
Phase 4   Event + RNG（可复现随机世界）
Phase 5   Narrative / Option Engine（首次接入 LLM）
Phase 6   Memory / Context（角色真的记得你）
Phase 7   LLM Gateway 落地（真实 Provider）
Phase 8   SillyTavern Adapter（Runtime 打通）
Phase 9   Minimal Play UI（文本可玩）
Phase 10  Designer Mode（设计器）
Phase 11  Simulation / Debug（可设计可调试）
Phase 12  Presentation Layer（表现层，后置）
```

## 0.2 总体执行原则（贯穿所有阶段）

1. **纯确定性逻辑先于 LLM**：Phase 2–4 完全不接 LLM；接 LLM 之前，Port 与 Schema 已冻结。
2. **Schema 先行**：所有跨模块数据结构在 Phase 1 冻结，后续阶段不再发明新字段。
3. **每阶段带测试**：无测试不进下一阶段。测试分层：Unit / Integration / Simulation / Golden。
4. **Turn 事务性贯穿始终**：`Read → Compute → Generate → Validate → Commit`，失败 Rollback。
5. **数据所有权不破坏**：任何核心状态只有一个权威写入路径（Master Design §5.3）。
6. **AI 提出、引擎确认**：LLM 输出永远经 Schema + 数值 + 状态三重校验（Master Design §3）。
7. **表现层后置**：Phase 12 之前不投入视觉/语音资源。

## 0.3 依赖关系

```text
Phase 0.5 → 1 → 2 → 3 → 4 → 5 ─┬→ 6 → 7 → 8 → 9 → 10
                                └── 5 依赖 7 的 Port（先建接口，7 落地实现）
```

关键解耦：Phase 5 需要的 LLM 能力以 **Port + TestProvider** 形式先行，Phase 7 才接入真实 Provider。Phase 2–4 不需要 LLM。

---

# 1. 技术决策基线

## 1.1 选型（定案）

| 项 | 选择 |
|---|---|
| 语言 | TypeScript（严格模式） |
| 包管理 | pnpm workspaces（monorepo） |
| 构建 | tsup（库）+ Vite（应用） |
| 测试 | Vitest |
| Lint / Format | ESLint + Prettier |
| 校验 | Zod + JSON Schema（Draft 2020-12） |
| UI | React 18+ |
| 持久化 | JSON（V1）→ SQLite（后期） |
| LLM | LLM Gateway（OpenAI / Anthropic / OpenAI-Compatible / Local） |

## 1.2 Monorepo 目录结构

```text
tavern_gal/  （仓库根）
├── package.json               # workspace 根，聚合脚本
├── pnpm-workspace.yaml
├── tsconfig.base.json         # 严格 TS 公共配置
├── vitest.workspace.ts
├── .eslintrc / .prettierrc
├── packages/                  # 库（按依赖自底向上）
│   ├── schemas/               # @ag/schemas  —— TS 类型 + Zod + JSON Schema（最底层）
│   ├── core/                  # @ag/core     —— GameState、Turn、Run、Day、StateResolver、RuleEngine、ProgressEngine、EndingEngine
│   ├── world/                 # @ag/world    —— World Engine（Time/Weather/Location/EventPool/WorldTick）
│   ├── character/             # @ag/character —— Character & Relationship Engine
│   ├── option/                # @ag/option   —— Option Planner/Validator/Renderer/Scorer
│   ├── memory/                # @ag/memory   —— Store/Formation/Decay/Retrieval/Reinforcement/Consolidation
│   ├── context/               # @ag/context  —— ContextBuilder/Budget/Ranker/Summarizer/PromptComposer
│   ├── narrative/             # @ag/narrative —— Scenario/Option/Reaction 生成（消费 LLM Port）
│   ├── runtime/               # @ag/runtime  —— Application 层：Turn Orchestrator、游戏/叙事/记忆服务编排、Application API
│   ├── persistence/           # @ag/persistence —— Save/Load/Export（JSON→SQLite）
│   └── adapters/
│       ├── llm/               # @ag/llm      —— LLM Gateway（Port + Provider + TestProvider）
│       └── sillytavern/       # @ag/st-adapter —— Character Card / World Book / Context Bridge / Extension
├── apps/
│   ├── player/                # React 玩家 UI（Play Mode）
│   ├── designer/              # React 设计器（Design Mode）
│   └── devtools/              # CLI：Simulation / Turn Debugger / Inspector / Golden Test
├── projects/                  # 示例游戏 Project 包
├── saves/                     # 运行时存档输出（gitignore）
├── tests/                     # 跨包集成 / 模拟 / 金样测试
└── docs/
    └── design-history/        # 旧 v0.1 设计文档（归档，不再修改）
```

## 1.3 包依赖（自底向上，禁止反向依赖）

```text
schemas
  → core → world / character / option / memory
  → context（依赖 core、memory）
  → narrative（依赖 core、option、context、adapters/llm 的 Port）
  → runtime（依赖以上全部服务，编排 Turn）
  → persistence（依赖 core、schemas）
  → adapters/llm（依赖 schemas；narrative 只依赖其 Port 接口）
  → adapters/sillytavern（依赖 core、schemas、adapters/llm）
apps/*（依赖 runtime 与其他包，只通过 Application API 交互）
```

## 1.4 常用命令（约定）

```bash
pnpm install                          # 安装全部依赖
pnpm build                            # 按拓扑顺序构建所有包
pnpm test                             # 全仓测试（Vitest）
pnpm typecheck                        # 全仓类型检查（tsc --noEmit）
pnpm lint                             # ESLint + Prettier 检查
pnpm --filter @ag/<pkg> test          # 只跑某包测试
pnpm --filter @ag/<pkg> build         # 只构建某包
pnpm dev                              # 启动 apps（player/designer）
```

每个包统一暴露脚本：`build` / `test` / `typecheck` / `lint`。

---

# 2. Phase 0 — 设计冻结

- **状态**：✅ 已完成（本文档与 `AI_GALGAME_Master_Design_v1.0.md` 即产物）。
- 说明：设计基线已定案，旧文档已归档 `docs/design-history/`。

---

# 3. Phase 0.5 — 工程初始化（TS Monorepo）

- **状态**：✅ 已完成。

## 3.1 目标
搭建可构建、可测试、可扩展的 TypeScript monorepo 骨架，取代当前 Python 占位脚手架。

## 3.2 验收标准
- `pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint` 全绿。
- 目录结构与 §1.2 一致；`packages/schemas` 可独立构建。

## 3.3 任务清单
- [x] **清理 Python 脚手架**：移除 `pyproject.toml`、`uv.lock`、`.python-version`、`.uv-cache/`、`.venv/`、`src/`。*（删除前需与用户确认）*
- [x] 根 `package.json`（workspace 聚合脚本）、`pnpm-workspace.yaml`、`tsconfig.base.json`（strict）。
- [x] `vitest.workspace.ts`、ESLint + Prettier 配置。
- [x] 建立全部 `packages/*` 与 `apps/*` 占位包（最小 package.json + `index.ts`）。
- [x] `packages/schemas` 立起骨架：导出 `schemas/` 目录与共享类型占位。
- [x] `.gitignore`（node_modules、dist、saves、.claude 等）。
- [x] README 更新为项目说明（含构建/测试命令）。

## 3.4 验证命令
```bash
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

## 3.5 涉及模块
全部包骨架；无业务逻辑。

---

# 4. Phase 1 — 数据契约冻结

- **状态**：✅ 已完成（2026-08-16）；审查反馈（`docs/review/phase1-review.md`）已在 Phase 2 前修订并通过回归。

## 4.1 目标
冻结全部跨模块数据契约：**TS 类型 + Zod 运行时校验 + JSON Schema**。这是整个项目的数据地基（Master Design §4）。

## 4.2 验收标准
- 每个 Schema 有 Zod parse 测试（合法样本通过、非法样本拒绝）。
- 类型系统与运行时校验行为一致（同源实现，不手写两遍字段）。
- §4.11 待冻结清单全部转正；Master Design 更新为"已冻结"。

## 4.3 任务清单（按依赖优先级顺序实现）
- [x] **共享基元**：`ID/RunId/TurnId/...`、`GameTimestamp`、`Percent(0~100)`、`NumericRange`。
- [x] **迁移已冻结 State**：GameState、RunState、CharacterState（identity/personality/psychology/emotion/cognition/physical/activity）、RelationshipState、WorldState、PlayerModel、MemoryState、MemoryRecord、MetaState、RNGState。
- [x] **① Option**（Master Design §4.10）：presentation / behavior / gameplay / effects / conditions / generation。
- [x] **② StateDelta**：run / character / relationship / world / flags / memoryCandidates / meta；区分 `BaseDelta / Modifier / FinalDelta`。
- [x] **③ Event**：EventDefinition / EventCandidate / EventInstance / EventResult + weight/rarity/condition/cooldown。
- [x] **④ TurnResult**：State Before / Choice / Direct Delta / Reaction / Secondary Delta / New Memories / Player Model / World Update / Final State。
- [x] **⑤ Context（ModelContext）**：System Rules / Current State / Recent Events / Retrieved Memories / Internal State / Generation Task + budget。
- [x] **⑥ SaveSnapshot**：SaveMetadata + 完整快照结构。
- [x] **⑦ Project**：project.json + characters/world/parameters/options/events/endings/prompts 的包结构。
- [x] **⑧ CharacterDefinition**：identity/personality/preferences/speech/psychology defaults/cognition/relationship defaults/secrets/goals/boundaries/game parameters。
- [x] JSON Schema 文件（由 `scripts/generate-json-schema.mjs` 从 Zod 同源生成，Draft 2020-12）。

## 4.4 测试要求
- Unit：每个 schema 的 valid / invalid 样本表驱动测试。
- 一致性测试：TS 类型编译期 + Zod 运行期对同一数据的校验结论一致。

## 4.5 验证命令
```bash
pnpm --filter @ag/schemas test && pnpm --filter @ag/schemas build
```

## 4.6 涉及模块
`packages/schemas`。后续所有阶段只消费本阶段产物，**不得发明新字段**。

---

# 5. Phase 2 — Pure Game Core

- **状态**：✅ 已完成（2026-08-16）。50 Turn 模拟验收通过。

## 5.1 目标
完全不接 LLM 的纯规则闭环：`GameState → Option(手工构造) → StateDelta → StateResolver → New GameState` 可稳定运行（Master Design §9.1）。

## 5.2 验收标准
- 纯程序模拟**连续 50+ Turn 不破坏 GameState**（状态校验通过）。
- State Snapshot / Diff 正确；Turn 事务可 Rollback。

## 5.3 任务清单
- [x] GameState 工厂：`createGameState()`、`defaultCharacter()`、深拷贝、`applyDelta()`、`diff()`、值 `clamp()`。
- [x] ProgressEngine：Daily Progress 推进与 Day 切换。
- [x] Turn 事务外壳：`startTurn / resolveChoice / commitTurn / rollback`（先以 stub 服务占位，Phase 3/5 填充）。
- [x] RuleEngine：数值范围、条件判断、Flag 读写。
- [x] EndingEngine：基于示例条件的 Good/Normal/Bad 判定（条件由 Project 配置）。
- [x] **内存模拟器**：`simulateNTurns(state, options, n)` 纯函数，供测试与 Phase 11 复用。

## 5.4 测试要求
- Unit：create/diff/applyDelta/clamp/Progress/Day 切换/Ending 条件。
- Integration：50 Turn 模拟后 `validateGameState` 通过。

## 5.5 验证命令
```bash
pnpm --filter @ag/core test && pnpm --filter @ag/core build
```

## 5.6 涉及模块
`packages/core`（依赖 schemas）。

---

# 6. Phase 3 — State Resolver

- **状态**：✅ 已完成（2026-08-16）；审查反馈（`docs/review/phase3-review.md`）已修订：重复反馈仅按主导行为计数，避免同一观察被 recent/historical 双计。

## 6.1 目标
完成 Modifier 引擎，实现"同行为不同角色不同结果"（Master Design §4.10）。

## 6.2 验收标准
- **核心玩法测试**：相同 Option + 不同 Character → 不同 StateDelta。
- 非法 AI 数值被忽略并用规则重算；数值始终在 0~100（Clamp）。
- 非线性反馈与重复行为反馈生效（机械刷好感无效）。

## 6.3 任务清单
- [x] Delta 分层：`BaseDelta → Modifier 链 → FinalDelta`。
- [x] Modifier 引擎：`Personality / Relationship / Context / Emotion` 乘数计算。
- [x] 公式引擎：`ΔX = Base × Π modifiers` + 取整。
- [x] 非线性反馈：靠近上下限边际收益衰减（`f(Affection)` 曲线）。
- [x] 重复反馈：读 `recentBehaviorPattern` / `behavioralPatterns`，重复递减/转负。
- [x] Risk 分支：成功/失败结果经 RNG 决定（先接 RNG 接口，Phase 4 落地实现）。
- [x] 变量联动/冲突处理（如 independence 高时 help 行为收益方向反转）。
- [x] Resolver 签名：`resolveChoice(state, selectedOption, rng) → TurnDirectDelta`。

> **Phase 3 范围说明**：`Option.effects` 当前只结算 relationship 数值；character / world / run effects 将在后续 Phase 显式接入。个性-行为映射与风险倍率当前为硬编码，Phase 10/11 转为 CharacterDefinition / Project 参数数据驱动。

## 6.4 测试要求
- Unit：公式/Clamp/非线性/重复递减/Risk。
- 特性：同行为不同角色；依赖型 vs 独立型角色的"我来帮你吧"。

## 6.5 验证命令
```bash
pnpm --filter @ag/core test
```

## 6.6 涉及模块
`packages/core`（StateResolver 子模块）。

---

# 7. Phase 4 — Event + RNG

- **状态**：✅ 已完成（2026-08-16）。RNG Replay、权重分布、条件/冷却/稀有度、WorldTick 骨架测试全部通过。

## 7.1 目标
建立"无固定剧情但规则可控"的随机世界（Master Design §2.6）。

## 7.2 验收标准
- 事件选择符合权重/条件/冷却/稀有度；**RNG Replay 测试通过**（同 seed 同结果）。
- 事件分布可调（改权重即变分布）。

## 7.3 任务清单
- [x] RNG 服务：`seed + state + algorithm`（xorshift128 或等价），可 `save/restore`。
- [x] EventPool：EventDefinition 注册、EventInstance 实例化。
- [x] Event 选择：`EventScore = BaseWeight × ContextMod × CharacterMod × RelationshipMod × RandomFactor`。
- [x] Condition / Cooldown / Rarity（Common→Legendary 稀有度预留）。
- [x] WorldTick 接口：时间/天气/地点/NPC 位置/公共事件推进（World Engine 骨架）。
- [x] `selectEvent(state, rng) → EventInstance`。

## 7.4 测试要求
- Unit：权重选择、条件过滤、冷却、稀有度。
- Integration：RNG Replay（100 次同 seed 序列一致）；分布统计（改权重后分布随之改变）。

## 7.5 验证命令
```bash
pnpm --filter @ag/world test && pnpm --filter @ag/core test
```

## 7.6 涉及模块
`packages/world`（+ core 的 RNG Port）。

---

# 8. Phase 5 — Narrative / Option Engine（首次接入 LLM）

- **状态**：✅ 已完成（2026-08-16）；审查反馈（`docs/review/phase5-review.md`）已修订：Option Realization 改为 LLM 输出自然语言 presentation，NPC Reaction 注入结算结果。

## 8.1 目标
LLM 生成场景与选项，但 **StateResolver 仍掌握最终状态权**（Master Design §3）。

## 8.2 前置
本阶段需要 LLM 能力。按解耦原则：先定义 **LLM Port（接口 + TestProvider）**，真实 Provider 在 Phase 7 落地。本阶段所有测试用 TestProvider 固定 fixture。

## 8.3 验收标准
- AI 双通道输出（自然语言 + 结构化）被引擎正确消费。
- 非法结构化输出（坏 JSON / 越界数值）触发 Retry → Fallback，不破坏状态。

## 8.4 任务清单
- [x] LLM Port：`LLMGateway.generate(req): Promise<res>` + `LLMRequest/LLMResponse` 类型 + `TestProvider`（fixture 驱动）。
- [x] ScenarioGenerator：输入 ModelContext → 输出 `GeneratedScenario`（场景 + 情绪/意图结构化）。
- [x] OptionPlanner：按约束生成行为类型（`support/low risk` 等）。
- [x] OptionValidator：多样性 / 条件 / 角色一致性校验。
- [x] OptionRenderer：行为 → 自然语言（表面语言）。
- [x] ReactionGenerator：玩家选择后生成 NPC 反应（双通道）。
- [x] 结构化输出解析与校验：Schema → 非法 Retry → Fallback 模板。
- [x] 与 Turn 生命周期接线：05/06/07/10 阶段调用对应生成器。
- [x] **事件触发接线（Phase 4 review 必做项）**：事件选择成功后，Turn 编排必须把 EventInstance 写入 `world.activeEvents`（设置 `lastTriggeredDay = 当前 day`）并调用 `EventPool.recordTriggered`；补端到端天数/回合冷却测试。

## 8.5 测试要求
- Integration：用 TestProvider 覆盖完整 Turn 的 Scenario→Option→Choice→Reaction 链路。
- 可靠性：坏 JSON / 越界数值 / 不符合角色设定的处理路径。

## 8.6 验证命令
```bash
pnpm --filter @ag/narrative test && pnpm --filter @ag/llm test
```

## 8.7 涉及模块
`packages/narrative`、`packages/option`、`packages/adapters/llm`（仅 Port + TestProvider）。

---

# 9. Phase 6 — Memory / Context

- **状态**：✅ 已完成（2026-08-16）；审查反馈（`docs/review/phase6-review.md`）已修订：中文检索采用标点分段 + 字符 bigram，衰减时钟从 lastRetrievedAt 起算。

## 9.1 目标
实现"角色真的记得你"（Master Design §4.8）。

## 9.2 验收标准
- 记忆衰减 / 强化 / 检索符合算法；不同认知 Profile 生成不同 Context。
- ContextBudget 永不超限；检索记忆进入本轮 Context。

## 9.3 任务清单
- [x] MemoryStore：records + short/long/forgotten 分层 + 索引。
- [x] MemoryFormation：候选评分与阈值（低分只留 Recent Events）。
- [x] MemoryDecay：`S(t)=S₀·e^(−λt)`，λ 受认知参数影响。
- [x] MemoryRetrieval：`Score = w_r·R + w_i·I + w_e·E + w_s·S + w_o·O`，Top-K。
- [x] MemoryReinforcement：检索后强度回升。
- [x] MemoryConsolidation：Day 结束短期→长期/丢弃。
- [x] ContextBuilder：`GameState + 检索记忆 + 当前事件 + 认知 → ModelContext`。
- [x] ContextBudget：按认知容量分配（System/Current/Recent/Memories/Internal）。
- [x] MemoryRanker / StateSummarizer / PromptComposer。
- [x] 与 Turn 生命周期接线：04/12/16 阶段。

## 9.4 测试要求
- Unit：decay 曲线、reinforce 回升、retrieval 排序、budget 不超限。
- Integration：Memory→Context→LLM(fixture) 链路；健忘角色 vs 记忆强角色输出不同。

## 9.5 验证命令
```bash
pnpm --filter @ag/memory test && pnpm --filter @ag/context test && pnpm --filter @ag/narrative test
```

## 9.6 涉及模块
`packages/memory`、`packages/context`。

---

# 10. Phase 7 — LLM Gateway 落地

## 10.1 目标
接入真实 LLM Provider，切换模型不改核心逻辑（Master Design §5.5）。

## 10.2 验收标准
- OpenAI / Anthropic / OpenAI-Compatible / Local 适配器可切换；Provider 由配置驱动。
- 重试 / 超时 / Token 计数 / 成本日志可用；失败有明确错误类型。

## 10.3 任务清单
- [ ] OpenAIAdapter / AnthropicAdapter / OpenAICompatibleAdapter（Local 作为 OpenAI-compatible 变体预留）。
- [ ] Provider 注册表与配置加载（API key / baseURL / model / 参数）。
- [ ] 重试 / 超时 / 退避策略；错误分类（parse/rate-limit/timeout/refusal）。
- [ ] Token 计数与成本日志（供 Phase 11 的成本分析）。
- [ ] **LLM Call Minimization（Phase 5 review）**：将 Scenario + Options 合并为 1 次调用，使每个 Turn 从 3 次降为 2 次。
- [ ] `ModelContext → Provider 请求` 转换；Provider 响应 → 结构化校验入口。

## 10.4 测试要求
- Mock provider 适配测试：请求形状、重试、错误分类。
- 切换 Provider 后核心逻辑测试仍通过（回归）。

## 10.5 验证命令
```bash
pnpm --filter @ag/llm test
```

## 10.6 涉及模块
`packages/adapters/llm`。

---

# 11. Phase 8 — SillyTavern Adapter

## 11.1 目标
与 SillyTavern 打通（Master Design §5.6）：Character Card / World Book / Context Bridge / Extension。

## 11.2 验收标准
- 一份 CharacterDefinition 可编译为 ST Card + World Book；可从现有 Card 反向导入。
- ModelContext 可桥接为 ST Prompt。

## 11.3 任务清单
- [ ] Character Card 生成 / 解析（PNG 元数据卡或 ST JSON 格式）。
- [ ] World Book / Lorebook 生成 / 解析。
- [ ] Context Bridge：`ModelContext ↔ ST Prompt` 映射。
- [ ] Extension 通信协议（ST API / extension API）定义与基础实现。
- [ ] Character Compiler：`CharacterDefinition → Card + WorldBook + Prompt + GameCharacter`（双向）。

## 11.4 测试要求
- 导出 / 导入 round-trip fixture 测试。

## 11.5 验证命令
```bash
pnpm --filter @ag/st-adapter test
```

## 11.6 涉及模块
`packages/adapters/sillytavern`。

---

# 12. Phase 9 — Minimal Play UI

## 12.1 目标
第一版可玩 UI（Master Design §1.5）：文本闭环完整呈现。

## 12.2 验收标准
- 端到端完成一个完整 Turn 循环并进入下一 Turn。
- 界面要素齐全：背景占位 + 角色名 + 叙事 + 3~4 选项 + Daily Progress + 最小状态 + 存档入口。
- **无自由输入框**，玩家只做选择。

## 12.3 任务清单
- [ ] `packages/runtime` 编排层：Turn Orchestrator 将各服务串联（世界/事件/上下文/叙事/选项/结算/记忆/存档）。
- [ ] Application API：`/game/start /turn/start /turn/choice /game/state /save /load /export` 的服务端形态（CLI 或 HTTP）。
- [ ] `apps/player` React 骨架 + API 客户端。
- [ ] UI 组件：叙事面板、选项按钮、状态栏（Day/Time/Progress）、关系显示、存档面板。
- [ ] 接入真实 LLM（默认 OpenAI-compatible 配置）跑通一轮 Run。
- [ ] 基础错误处理（LLM 失败回退、存档失败提示）。
- [ ] **事件触发接线复核（Phase 4 review）**：UI/编排层验证事件触发后 `world.activeEvents` 与天数冷却在真实 Run 中生效。

## 12.4 测试要求
- 组件测试（选项渲染、状态更新）。
- 端到端冒烟：启动应用 → 完成 1 个完整 Turn。
- 回归：Core / Narrative / Memory 集成测试全绿。

## 12.5 验证命令
```bash
pnpm --filter @ag/runtime test && pnpm --filter @ag/player build
pnpm dev   # 手动冒烟
```

## 12.6 涉及模块
`packages/runtime`、`apps/player`。

---

# 13. Phase 10 — Designer Mode

## 13.1 目标
创建角色 / 世界 / 规则的设计器（Master Design §5.9）。

## 13.2 验收标准
- 创建角色 → 生成酒馆资源 → 配置世界/参数/事件/选项模板/Ending/Prompt → 模拟 Run → 导出 Project。

## 13.3 任务清单
- [ ] Character Creator：CharacterDefinition 表单 → 编译到 Card/WorldBook/Prompt/GameCharacter。
- [ ] World Builder / Parameter Designer / Event Editor / Option Template Editor / Ending Editor / Prompt Editor。
- [ ] Project 包创建 / 导入 / 导出（`projects/` 落盘）。
- [ ] `apps/designer` UI 骨架与表单组件。
- [ ] Design→Play 联动：设计器产出 Project 直接被运行时加载。

## 13.4 测试要求
- Project round-trip（创建→导出→导入→内容一致）。
- CharacterDefinition → Card/WorldBook 编译测试。

## 13.5 验证命令
```bash
pnpm --filter @ag/designer build && pnpm test
```

## 13.6 涉及模块
`apps/designer`、`packages/schemas`（CharacterDefinition/Project）。

---

# 14. Phase 11 — Simulation / Debug

## 14.1 目标
让项目真正"可设计可调试"（Master Design §1.3 Debug 模式、§7）。

## 14.2 验收标准
- 批量模拟 100 / 1000 Runs 并输出统计：Ending 分布、平均天数/Turn、平均好感、Memory 增长、Context 大小、事件频率、选项频率、成本。
- Turn Debugger 可逐步回放：State Before / Context / Retrieved Memory / Event / Options / Selected / Direct Delta / Reaction / Secondary Delta / Memory / Final State。
- Golden Test：固定 RNG Seed + GameState + LLM Fixture 输出可复现。

## 14.3 任务清单
- [ ] `apps/devtools` CLI：`simulate --runs 100`、`debug-turn <turnId>`、`inspect <state>`、`replay --seed`。
- [ ] Simulation Engine（复用 Phase 2 模拟器 + 事件 + 选项生成 + 记忆）。
- [ ] 统计收集器与报告输出（含 LLM 成本估算）。
- [ ] Turn Debugger（基于 turn history + RNG state 回放）。
- [ ] Memory / Context / State Inspector。
- [ ] Golden Test 框架与首批 fixture。
- [ ] Context Explosion 测试（长 Run 下 Context 是否稳定）。
- [ ] **Memory 容量/修剪策略（Phase 6 review）**：校准 `records + forgottenIds` 只增不减问题，设置容量上限或修剪策略。
- [ ] **Memory 参数校准（Phase 6 review）**：用 100 Runs 仿真校准 formation threshold / 初始 strength / 重复反馈转负轮次。

## 14.4 测试要求
- Simulation 断言（统计落在合理区间、Ending 分布稳定）。
- Golden Test 可复现性。

## 14.5 验证命令
```bash
pnpm --filter @ag/devtools test
pnpm --filter @ag/devtools simulate --runs 100
```

## 14.6 涉及模块
`apps/devtools`。

---

# 15. Phase 12 — Presentation Layer

## 15.1 目标
表现层扩展（Master Design §1.5 后置项）。

## 15.2 验收标准
- 表现层**不改变 Core 游戏逻辑**（回归测试保证）。

## 15.3 任务清单（按优先级）
- [ ] 角色立绘 + 背景展示。
- [ ] GAL 对话框 / 打字机效果。
- [ ] CG 收集（Ending Archive 联动）。
- [ ] TTS / BGM / SE（可选、渐进）。
- [ ] Live2D / 动画（可选、最后）。

## 15.4 测试要求
- 回归：Core/Narrative/Memory/Context 全部集成测试不变绿。

## 15.5 验证命令
```bash
pnpm test && pnpm build
```

## 15.6 涉及模块
`apps/player`（表现层组件）。

---

# 16. 里程碑与风险

## 16.1 里程碑总表

| 里程碑 | 内容 | 判定 |
|---|---|---|
| M1 | Phase 1 完成 | 全部 Schema 冻结 + 校验测试 |
| M2 | Phase 4 完成 | 纯规则随机世界可模拟（无 LLM） |
| M3 | Phase 6 完成 | 角色记忆/上下文闭环（TestProvider） |
| M4 | Phase 9 完成 | 文本可玩的完整游戏闭环（真实 LLM） |
| M5 | Phase 11 完成 | 可设计可调试，模拟/金样通过 |
| M6 | Phase 12 完成 | 表现层就位，Core 逻辑回归通过 |

## 16.2 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Schema 后期返工 | 返工成本随阶段指数上升 | Phase 1 严格冻结；变更走 Master Design §0.3 |
| LLM 输出不可靠 | 状态被污染 | 三重校验 + Retry/Fallback + 事务回滚（§3.3） |
| Memory/Context 无限膨胀 | 成本爆炸 | ContextBudget 硬限制；Simulation 阶段 Context Explosion 测试 |
| 状态漂移（多路径写） | 数据不一致 | 数据所有权表；只经 Resolver/权威引擎写 |
| Token 成本过高 | 不可玩 | LLM Call Minimization（Turn 3 次）、Context Cache |
| 表现层过早投入 | 核心未验证就美化 | 严格 Phase 顺序，Phase 12 前不投入视觉资源 |

## 16.3 执行方式（Claude Code）

每阶段执行流程：

```text
1. 读取 Master Design 对应章节 + 本计划该阶段
2. 为该阶段产出实现计划（可调用 superpowers:writing-plans）
3. 按 TDD 实现（先测试后代码，或测试驱动关键算法）
4. 运行该阶段验证命令，确认验收标准全部满足
5. 更新 CLAUDE.md（如有架构/命令变化）
6. 进入下一阶段
```

**退出条件**：任何阶段验收不通过，则该阶段持续迭代直至通过，不带着未验证代码进入下一阶段。
