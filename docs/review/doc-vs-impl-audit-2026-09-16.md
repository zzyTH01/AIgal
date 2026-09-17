# 文档 vs 实现 差异审计与修复记录（2026-09-16）

> 审计方式：逐条核对 `AI_GALGAME_Master_Design_v1.0.md`（内容版本 v1.6）、`EVENT_LIFE_PLAN.md`、
> `docs/review/known-issues.md`、`CLAUDE.md` / `README.md` 的声明与 `packages/*`、`apps/*` 实际代码，
> 全部结论带 file:line 证据。**核心判据不是"类/函数是否存在"，而是"runtime 主路径是否真的调用"**。
>
> 本文分三部分：**一、核实属实**；**二、发现的差异**；**三、本次修复**；遗留见文末。
>
> 与上一轮 `doc-vs-impl-audit-2026-08-21.md` 的关系：那一轮修的是"实现未接线"，
> 本轮抓到的**还是同一类问题**——契约在、生成器在、runtime 没接。这说明它是本仓库的**结构性复发模式**，
> 不是一次性事故（已写入 `CLAUDE.md` 项目定位段作为长期提醒）。

---

## 〇、工程健康度（实测基线）

| 检查 | 结果 |
| --- | --- |
| `pnpm build` | ✅ 15 包 + 3 app 全绿 |
| `pnpm test` | ✅ 91 test files / 319 tests passed（本轮新增 5 个 POV 审计用例） |
| `pnpm typecheck` | ✅ 逐包 `tsc --noEmit` 通过 |
| `pnpm lint` | ✅ `eslint --max-warnings=0` + `prettier --check` 通过 |
| `git status` | clean，与 `origin/main` 同步（审计起点 `545ea89`） |

---

## 一、核实属实（文档可信部分）

以下声明**确已接入 runtime 主路径**，非仅测试调用：

| 声明 | 证据 |
| --- | --- |
| P0.5 Beat System 的 flow 状态机接入 | `FlowController` 由 `game-runtime.ts:217` 持有，`:557` `openFlow`、`:610` `produceBeat`、`:583-600` `advance()` |
| `branchPotential` 真的传入 `nextStep`（known-issues #15 第三轮校准） | `game-runtime.ts:637-639` 传 `{ branchPotential: this.lastBranchPotential }`，来源 `:676`（上一文段拍），choice 后清空 |
| `nextSuggestion` 已降级（#15 第四轮修复） | `beat-generator.ts:134-139` 非 `choice\|beat\|end` 一律 → `undefined`，不报废整拍；测试 `beat-generator.test.ts:161-177` |
| P1 Pending Intent 在每次开事件时触发 | `pickTopIntent`（`intent-engine.ts:119`）在 `prepareTurnContext` 内被调用（`game-runtime.ts:473`），由 `startTurn`(`:418`) 与 `advance`(`:588-590`) 进入 |
| P1 意图完成/过期机制 | `:515` `expireStaleIntents`（每次开事件先跑）→ `:517` `completeIntent` → `:520` `promoteMotiveToIntent` → `:529` `markIntentTriggered` |
| P2 Autonomous Event 在主路径生效 | `selectAutonomousEvent`(`:311-358`) 于 `:525` 生效（且被意图事件优先占用时让位），`:529-535` 提交事件 |
| `【自主发起】` 叙事指令存在 | `beat-generator.ts:285`（配套 `【自主动机】`/`【记忆驱动】`） |
| #16 遗留观察 a：反应场景 grounding | `ReactionGeneratorOptions.scene`（`reaction-generator.ts:21-31`）、`[当前场景]` 注入（`:101-105`）、scene 提供时 `[当前事件]` 只留标题（`:82-86`）、runtime 传参 `:758-765` |
| #16 遗留观察 b：台词级去重 | `EventFlow.recentDialogues`（`schemas/src/beat.ts:79-80`）、`recordFlowDialogues`（`game-runtime.ts:700-710`，≤60 字符 ×5 滚动）、进 `BeatContextInput`（`:298`）、prompt `[已发生台词]`（`beat-generator.ts:76-78`）、拒绝条件扩展（`:108-126`） |
| `importance` 字段已落地并被消费（P3 复用前提） | 契约 `schemas/src/beat.ts:60-61` / `event.ts:48`；生产消费 `game-runtime.ts:551-556`、`:744` `importanceImpactScale` |
| 双 Agent 门面被主路径调用 | `game-runtime.ts:643` `playerAgent.generateChoiceBeat`、`:663` `characterAgent.generateNarrativeBeats`、`:749` `characterAgent.generateReaction` |
| 视角契约注入（纵深防御） | 门面层 `buildSystemRules` 注入 system 消息；生成器层另在 user 消息保留一份（`beat-generator.ts:299`、`combined-generator.ts:165`、`reaction-generator.ts:100`） |

---

## 二、发现的差异

### A. 🔴 P0 Transition 的叙事管线已被后续重构移除，文档仍记"已完成"

**这是本轮最严重的发现。** `EVENT_LIFE_PLAN` P0 与 Master Design §11.2/§11.2.1 均标 ✅ 已完成，
但实际已被 P0.5 Beat System 提交取代：

| 事实 | 证据 |
| --- | --- |
| P0 管线由 `c49cff4`（P0 S1–S7）引入，由 `f4b843d`（Beat System T1–T7）**删除** | `git log -S "pendingTransition" -- packages/runtime/src/game-runtime.ts` 仅这两个提交 |
| 当前 `packages/runtime/src/` 内**零** transition 痕迹 | `grep -rn "transition" packages/runtime/src/` 无输出 |
| `TurnTransaction.setTransition` 契约保留但**无生产调用方** | 定义 `core/src/turn.ts:185`，写入 `TurnResult.transition`（`:214`）；全仓无调用 |
| `CharacterAgent.generateTransition`（双 Agent 门面的角色职责之一）**无调用方** | 定义 `character-agent.ts:121-134` |
| Player UI 的 `kind:'transition'` 语义已变 | `NarrativePanel.tsx:4-5` 指的是**文段拍**，不再是 `TransitionRecord` |
| **存活部分**：日内时间流动（S2） | `core/src/turn.ts:106` → `advanceIntradayTime` |
| B 组亦未接线：地点迁移**无驱动源** | `world.currentLocationId` 在 runtime 只被读（`:291-292` 等）、**从未被写** |
| B 组亦未接线：环境演化无 runtime 调用方 | `evolveWorld`（`world/src/weather-calendar-schedule.ts:115`）全仓无外部调用 |

**影响**：①事件之间仍是硬切；②`EVENT_LIFE_PLAN:358` 声明"P3 依赖 P0：Micro Event 需要 Transition 提供的生活流"、
§7.2 有"Transition 接入"任务——按原文档口径开工会在两处踩空；③P0 验收报告 §2.3 的七条标准中，
第 2/6/7 条依赖的管线已不存在，**当前不成立**。

**定案（2026-09-16，本轮确认）**：「事件内」位置的过渡文段由 Beat System 的 `NarrativeBeat` **合法取代**
（连续叙事流比单段过场更贴合该位置）；「事件之间」的过渡**留到 P5 Event Scheduler 统一调度时接入**，
契约与生成器作为预留保留、不删除。P3 因此**不再阻塞于 P0 表现层**。

### B. 🟠 `PlayerAgent` 的「场景」职责是死代码；`currentScenario` 可能为空串

- `PlayerAgent.generateScenarioAndOptions`（`player-agent.ts:82-95`）**无生产调用方**；
  主路径只走 `generateChoiceBeat`，`currentScenario` 取 `result.intro`（`game-runtime.ts:658`）。
- `intro` 在契约里是 **`z.string().max(160).optional()`**（`beat-generator.ts:55`）——
  缺失时 `currentScenario.narrative` 退化为**空串**（`:658` 的 `result.intro ?? ''`）。
- 文档"玩家 Agent：场景+选项，内部复用 combined-generator"的表述与实现不符。

### C. 🟠 "两 Agent 各自分流上下文 / 各自校验输出"表述强于实现（#16 ②）

- **上下文未按 Agent 裁剪**：`produceBeat` 两条路径**共用同一份** `buildBeatInput(state, context)` 产物
  （`game-runtime.ts:640`），区分只存在于 prompt 契约文本。
- **校验仅结构校验**：`PlayerAgent.validateOutput`(`player-agent.ts:40-63`) 只查「options 非空 + scenario.narrative 非空」；
  `CharacterAgent.validateOutput`(`character-agent.ts:43-80`) 只查「narration 非空 + 拍内不得含 options」。
  **视角契约本身没有自动化校验**，违规仅 `console.warn`（`game-runtime.ts:208-215`）。

### D. 🟠 视角契约此前**只靠 prompt 保障**，#16 类回归无法被 CLI 捕获

#16 是一次真实的 POV 回归，其复验结论（四项 POV 指标）**依赖人工分析对局 Markdown**——
`apps/devtools` 内无相关代码（`grep -rn "POV\|第一人称" apps/devtools/src/*.ts` 无输出）。
即：同类回归下次仍只会静默发生。

### E. 🟡 `known-issues.md` 内部自相矛盾

§#16 与其"遗留观察"（`:39-42`）已标"✅ 已修复"，但文末"修复优先级建议 / 近期：P3 前置修复"
仍把这两项列为待做 🟠。

### F. 🟡 "P3 实施计划 S1–S5 已定"无落盘文档

`CLAUDE.md:171` / `AGENTS.md:171` / `README.md:62` 声称 S1 层级确认→S2 Micro 池→S3 调度接入→
S4 叙事短路→S5 记忆与验收**已定**，但全仓库 md 检索只有这一行摘要，
`EVENT_LIFE_PLAN.md` §5.2 仍是 4 条泛化任务。项目自身惯例是"实现前必须先读权威文档"——
计划不落盘等于没有计划。

### G. 🟢 口径小差异

- 文档写 `[自主发起]`，代码实为全角 `【自主发起】`（`beat-generator.ts:285`）。
  代码内约定：**`【】` 表指令、`[]` 表数据段**（`[检索记忆]`/`[当前场景]`/`[已发生台词]` 等）。
- `nextSuggestion` 字段虽已按 #15 降级，但**从未被 runtime 消费**——`NextStepSignals`
  （`flow-controller.ts:40-43`）根本不接受该字段；`tensionResolved` 亦从未由 runtime 传入（`:638` 只传 `branchPotential`）。
  即该字段是"存而不用的契约"。

---

## 三、本次修复（2026-09-16）

### Fix-1 P0 Transition 定案与全文档同步（A）

按「事件内归 Beat System、事件之间留 P5」定案，**如实标注**而非恢复实现：

- `AI_GALGAME_Master_Design_v1.0.md`：§11 头部状态、§11.2 标题（✅ → ⚠️ 部分实现）、
  §11.2.1 增「接线状态」段、§11.7 增「P5 承担 Transition 重新接入」段、
  §11.11 角色 Agent 职责与校验现状、§11 实现优先级行。
- `EVENT_LIFE_PLAN.md`：§2 状态改为**部分完成**并附复核修正；§2.2 中 B/C 组不再属实的勾选项
  改为 `[ ]` 并注明原因；§2.3 增复核说明；§11 依赖关系改写（P3 不再阻塞于 P0 表现层）；
  §12 增接线状态提示。
- 代码侧 4 处加注（**不删契约**）：`schemas/src/transition.ts` 文件头、
  `core/src/turn.ts` `setTransition`、`character-agent.ts` `generateTransition`、
  `player-agent.ts` `generateScenarioAndOptions`。

### Fix-2 新增 POV 自动审计（D）

- 新增 `apps/devtools/src/pov-audit.ts`（纯函数）+ `pov-audit.test.ts`（5 用例）：
  把 #16 复验时人工统计的四项指标做成可复现产出——
  旁白「我」开场比例、内心泄露命中数、选项主语为玩家占比、motive 覆盖率。
- `live-verify` 报告新增 `pov` 字段（`live-verify.ts` 采集旁白/选项文本，只取 `source: 'llm'` 以免被模板稀释）；
  `@ag/devtools` 导出该模块。
- **诚实声明局限**（写入模块头注释与 known-issues #18）：这是**启发式信号非硬门禁**——
  漏报改写措辞、误报跨小句主体（如「我看着她，明白了一些事」记为「她，明白」），
  报告保留命中片段供人工复核；只审计旁白（对话中角色说「我知道」是合法台词）；
  **Demo 模式因模板旁白无「我」而恒为 0，指标仅在真实 LLM 运行下有意义**。

### Fix-3 口径与台账修正（C/E/F/G）

- `known-issues.md`：新增 **#17**（Transition 未接入，已定案推迟 P5）与 **#18**（POV 无自动化校验，已补审计）；
  重写"修复优先级建议"消除自相矛盾（#16 两项观察不再列为待做，编号顺延）；
  在 #16 ②后加「2026-09-16 复核修正」说明表述强于实现。
- 全套文档 `[自主发起]`/`[自主动机]`/`[记忆驱动]` → 全角 `【】`，与代码一致。
- P3 实施步骤 **S1–S5 落盘**至 `EVENT_LIFE_PLAN.md` §5.2.1（含每步落点与完成判据），
  并写明「**不得依赖 `TransitionRecord`**」与 P5 的分工边界。
- `CLAUDE.md` / `AGENTS.md`（两文件为镜像，由 `CLAUDE.md` 重生成）/ `README.md` 同步以上全部状态。

### 测试

新增 5 个用例（`apps/devtools/src/pov-audit.test.ts`）：内心泄露识别（含跨逗号写法与不跨句末标点的反例）、
「我」开场判定（含引号装饰）、选项主语三分类（玩家/祈使惯例/NPC 越权）、
干净样本四项指标全过、违约样本（#16 回归）被捕获。

最终回归：`pnpm build && pnpm test && pnpm typecheck && pnpm lint` 全绿（91 test files / 319 tests）。

---

## 四、仍未解决 / 后续

1. **`currentScenario` 可能为空串**（B）——本轮只加注未改行为。建议在 `game-runtime.ts:658`
   对 `intro` 缺失给出显式兜底文案（而非空串），或让 PlayerAgent 保证引子非空。
2. **POV 审计的强度**（#18）——当前是可观测信号；若需硬门禁，需更强判定
   （生成端自检 / 第二模型复核）。未纳入本轮。
3. **`nextSuggestion` / `tensionResolved` 的契约清理**（G）——存而不用的字段建议随 P5 一并决断
   （接入 `NextStepSignals` 或从 schema/prompt 移除）。
4. **P0 B 组的两项缺口**——地点迁移（需 World/Location 迁移规则）与环境演化（`evolveWorld` 接 runtime），
   属 World Engine 接线任务，与 P5 同批处理更自然。
5. **主线不变**：Life Engine **P3（§5.2.1）→ P4 → P5（含 #17 Transition 接入）**；随后部署层
   HTTP Application API / PNG 卡 / 真实立绘音频资源。

> 备注：本轮未运行真实 LLM 复验（本机无 `LLM_API_KEY`），POV 审计的**数值**需在真实 Provider 下
> 跑 `ag-devtools live-verify` 才有意义；Demo 模式已验证采集与汇总链路可用。
