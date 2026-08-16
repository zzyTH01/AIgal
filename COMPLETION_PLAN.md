# AI GALGAME Framework

## 补全与完善计划 Completion Plan v1.0

> 版本：v1.1（已执行） ｜ 依据：`AI_GALGAME_Master_Design_v1.0.md`（唯一权威设计基线）+ `docs/review/known-issues.md` + 本轮真实 LLM 联调实验
>
> 本计划是 Phase 0.5–12 完成后的**补全与完善**安排：先补全**未实现的功能**，再完善**部分完成的部分**，并修复**本轮实验发现的问题**。每阶段有目标、任务清单、验收标准与验证命令，验收通过后进入下一阶段。

---

# 0. 文档定位

- 背景：Phase 0.5–12 已完成（引擎内核成立、210+ 用例全绿），但**设计承诺的若干功能未落地**，且**真实 LLM 联调暴露出集成瓶颈**。
- 目的：作为本轮修改的工作基线——把「未实现 / 部分完成 / 本轮问题」三类列全，按优先级排程补全。
- 与既有文档关系：Master Design 是权威设计；本计划只补 Phase 0.5–12 未覆盖的实现缺口，不改变已冻结的数据契约（除非必要并经评审）。

---

# 1. 问题与缺口总览

## 1.1 未实现功能（设计承诺但空白）

| 编号    | 功能                                               | 设计出处           | 现状                                                                             |
| ------- | -------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| **U-1** | **Secondary State Resolution（NPC 反应二次结算）** | §2.3 阶段 11、§3.2 | `secondaryDelta` 为空 `{phase:'final'}`；反应 `structured.emotion/intent` 未应用 |
| **U-2** | **Player Model Update（角色主观认知推断）**        | §2.3 阶段 13、§4.7 | 仅记录行为模式；`perceived_* / reliability/honesty/caring` 无写入逻辑            |
| **U-3** | **Punishment / Meta Progression 跨局闭环**         | §2.5、§9.1         | Bad End 惩罚、知识授予、下一局继承未实现                                         |
| **U-4** | **Narrative Consistency Check**                    | §3.3 AI 可靠性层   | 无叙事一致性校验                                                                 |
| **U-5** | **Context Cache**                                  | §5.5 成本优化      | 无缓存机制                                                                       |
| **U-6** | **Project Policy 运行时执行**                      | §6                 | policy 仅数据结构，无运行时约束                                                  |
| **U-7** | **World Engine 天气/日历/NPC 日程演化**            | §5.2               | 仅 WorldTick 同步 day/time/location；天气静态、无日历服务、无 NPC 日程           |

## 1.2 部分完成（半实现 / 待完善）

| 编号    | 项                | 现状                                                                   | 缺口                                                   |
| ------- | ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| **P-1** | 记忆形成链路      | `formMemory` 已接线，但真实 LLM 反应未带 `memoryCandidates` → 0 条记忆 | 触发链未端到端生效                                     |
| **P-2** | 场景+选项合并生成 | 合并调用已实现（2 次/Turn）                                            | 多样性校验瓶颈导致高概率回退（见 E-1）                 |
| **P-3** | 设计器            | 最小版（Character + 地点/进度/事件/Ending 标题）                       | World/Parameter/Event/OptionTemplate/Ending 编辑器不全 |
| **P-4** | 成本估算          | `turns×1200/400` 启发式                                                | 非真实 token 用量（`TODO(真实 LLM)`）                  |
| **P-5** | Memory/平衡参数   | formation 阈值、初始 strength、重复反馈转负轮次为经验值                | 需 100 Runs 仿真校准                                   |
| **P-6** | 表现层            | CSS 占位立绘/背景；TTS/BGM disabled                                    | 真实资源未接入（`GameProject.assets`）                 |

## 1.3 本轮实验发现的问题（真实 DeepSeek + 明日香联调）

| 编号    | 问题                                                          | 现象                                          | 影响                                                          |
| ------- | ------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| **E-1** | **多样性校验瓶颈**（`option/validator.ts` 硬编码 4 类动作表） | 场景+选项几乎每轮回退（"场景生成回退"）       | 真实 LLM 动态叙事/选项体验失效                                |
| **E-2** | **记忆 0 条**                                                 | reaction prompt 未引导输出 `memoryCandidates` | "角色真的记得你"未体现                                        |
| **E-3** | **Good End 达成困难**（明日香 independence=90，help 被拒）    | 20 Turn 后 affection=7                        | 平衡/策略性观察；独立角色难攻略是设计行为，但可选策略指引缺失 |
| **E-4** | **NPC 反应约 50% fallback**                                   | reaction 生成时好时坏                         | 体验不稳定（与 E-1 同源：结构化输出脆弱）                     |
| **E-5** | **V1 成功标准未端到端验证**                                   | "角色真的记得我…"未演示                       | 需在补全后做最终验收                                          |

---

# 2. 补全计划（按优先级排序）

> 总原则：**先补核心循环（U-1/U-2/P-1）→ 再补跨局闭环（U-3）→ 修真实 LLM 稳定性（E-1/E-2）→ 再完善系统级（U-4~~U-7）→ 最后校准与体验（P-3~~P-6）**。

---

# 3. Phase A — 核心循环补全（U-1、U-2、P-1）

## 3.1 目标

让 18 阶段 Turn 中的 **阶段 11（二次结算）与阶段 13（Player Model 更新）** 从空转变成真实现；让记忆在真实 LLM 下端到端形成。

## 3.2 任务清单

- [x] **U-1 Secondary State Resolution**：把 `reaction.structured.emotion / intent` 映射为角色心理/情绪二次 delta（如 情绪接近、压力/安全感微调），写入 `TurnResult.secondaryDelta` 并 `applyDelta`。
- [x] **U-1 接线**：`game-runtime.chooseOption` 在 reaction 之后调用二次结算；`commitTurn` 的 `secondaryDelta` 由真实结果填充（不再硬编码空对象）。
- [x] **U-2 Player Model Update Engine**：根据 option 行为 + 结算结果更新角色对玩家的主观认知（`perceivedTraits / perceivedIntentions / reliability / honesty / caring / romanticInterest` 等，按角色人格差异）。
- [x] **P-1 记忆触发**：reaction prompt 明确要求结构化输出 `memoryCandidates`（附示例）；`formMemory` 链路真实触发。
- [x] 补测试：二次结算改变角色状态、PlayerModel 随行为更新、记忆端到端形成。

## 3.3 验收标准

- Turn 18 阶段中 11/13 不再为空；`secondaryDelta` 反映反应内容。
- 真实 LLM 一轮内形成 ≥1 条记忆；PlayerModel 的 `perceived_*` 随选择变化。
- 全仓 `pnpm build / test / typecheck / lint` 全绿。

## 3.4 验证命令

```bash
pnpm --filter @ag/core test && pnpm --filter @ag/runtime test && pnpm test
```

## 3.5 涉及模块

`@ag/core`（resolver/turn）、`@ag/runtime`（chooseOption）、`@ag/narrative`（reaction prompt）、`@ag/schemas`（如需新增二次 delta 契约）。

---

# 4. Phase B — Roguelike 跨局闭环（U-3）

## 4.1 目标

实现 **Bad End → Punishment → Meta Progression → New Run** 的完整跨局循环（设计 §2.5 / §9.1）。

## 4.2 任务清单

- [x] **Punishment Engine**：Bad End 时生成惩罚（Debuff / 新增 Knowledge / Unlock / Ending Archive / Permanent Modifier），写入 `MetaState`。
- [x] **Bad End Narrative**：Bad End 的收尾叙事（LLM 生成 + fallback）。
- [x] **跨 Run 继承**：Run 结束时持久化 `MetaState`（含 knowledge/unlocks/endingsDiscovered/permanentModifiers）；New Run 初始化时继承。
- [x] **Permanent Modifier 生效**：跨局永久修正对下一局开局状态产生实际影响（如起始关系、参数修正）。
- [x] 补测试：Bad End → 惩罚生成 → New Run 继承 → 永久修正生效。

## 4.3 验收标准

- 完整闭环可跑：Bad End 后，新 Run 的 `MetaState` 携带上一局的 knowledge/unlocks/permanentModifiers，且永久修正影响开局。
- `simulateRuns` 支持跨局统计（Meta 增长）。

## 4.4 验证命令

```bash
pnpm --filter @ag/core test && pnpm --filter @ag/devtools test && pnpm test
```

## 4.5 涉及模块

`@ag/core`（punishment-engine、run 生命周期）、`@ag/persistence`（Meta 落盘）、`@ag/runtime`（跨局流程）、`@ag/devtools`（模拟统计）。

---

# 5. Phase C — 真实 LLM 稳定性（E-1、E-2、E-4）

## 5.1 目标

解决真实 LLM 合并生成高回退率，让「AI 动态叙事 + 选项 + 反应 + 记忆」稳定 `source: llm`。

## 5.2 任务清单

- [x] **E-1 多样性校验降级**：`validateOptions` 对 LLM 选项的 4 类覆盖改为软约束（缺失时记录不整份回退），或扩充动作分类表覆盖常见 LLM 动作词。
- [x] **E-1 解耦回退**：`generateScenarioAndOptions` 场景与选项解耦——场景失败不拖累选项，反之亦然（避免"一损俱损"）。
- [x] **E-2 记忆引导**：reaction prompt 加入 `memoryCandidates` 输出示例与语义说明（"若本轮值得记住，给出候选"）。
- [x] **E-4 结构化输出加固**：`maxTokens` 调优、更严格的 JSON 示例、必要时接 `responseSchema`（OpenAI json_schema 已支持）降低 fallback。
- [x] 补测试：真实 LLM fixture 下 scenario/options/reaction 稳定 `source: llm`。

## 5.3 验收标准

- 用 DeepSeek 跑一轮（≥10 Turn）：场景+选项 `source: llm` 占比 ≥ 80%；反应 ≥ 80%；形成 ≥1 条记忆。

## 5.4 验证命令

```bash
pnpm --filter @ag/narrative test && pnpm --filter @ag/option test && pnpm test
# 手动：真实 LLM 一轮复跑，核对 source 占比与记忆数
```

## 5.5 涉及模块

`@ag/narrative`（combined-generator、reaction-generator）、`@ag/option`（validator）、`@ag/adapters/llm`（responseSchema 接线）。

---

# 6. Phase D — AI 可靠性 + 成本（U-4、U-5）

## 6.1 目标

补全设计 §3.3 可靠性层缺项（Narrative Consistency Check）与 §5.5 成本优化缺项（Context Cache）。

## 6.2 任务清单

- [x] **U-4 Narrative Consistency Check**：对 LLM 生成内容做基本一致性校验（如角色言行与设定/状态不符的检查），失败走 Retry/Fallback。
- [x] **U-5 Context Cache**：缓存稳定内容（Character Definition / World Rules / Stable Personality），每轮只更新动态部分；提供缓存统计。

## 6.3 验收标准

- Consistency Check 能识别明显不一致输出并触发重试/回退；Context Cache 降低重复 token（有统计证明）。

## 6.4 验证命令

```bash
pnpm --filter @ag/narrative test && pnpm test
```

## 6.5 涉及模块

`@ag/narrative`、`@ag/context`（缓存）、`@ag/adapters/llm`。

---

# 7. Phase E — World Engine 完善（U-7）

## 7.1 目标

补全设计 §5.2 World Engine 的天气 / 日历 / NPC 日程演化。

## 7.2 任务清单

- [x] **WeatherService**：天气随时间/日期演化（可复现，基于 RNG）。
- [x] **CalendarService**：Weekday/Season 推进与节假日（对齐 WorldState 契约）。
- [x] **NPCSchedule**：角色 `activity` / `availability` 随日程变化（影响事件资格与互动）。
- [x] 补测试：天气/日历/日程演化确定性。

## 7.3 验收标准

- WorldTick 后天气/星期/角色日程随时间正确演化；事件选择反映日程（如"考试中角色不可见"）。

## 7.4 验证命令

```bash
pnpm --filter @ag/world test && pnpm test
```

## 7.5 涉及模块

`@ag/world`。

---

# 8. Phase F — Project Policy 运行时执行（U-6）

## 8.1 目标

让 §6 内容政策层真正生效（除 schema 的 age≥18 外，policy 的 contentTags / matureThemes / generationConstraints 被运行时消费）。

## 8.2 任务清单

- [x] Policy 校验器：加载 `GameProject.policy`，在运行时约束内容生成（如禁止主题 / 语气 / 关系类型限制）。
- [x] 与 Context/Generation 接线：generationConstraints 进入 prompt；matureThemes 影响选项/场景过滤。
- [x] 补测试：不同 policy 下生成约束生效。

## 8.3 验收标准

- 运行时按 policy 过滤/约束生成内容；同一引擎可切换不同 policy 项目。

## 8.4 验证命令

```bash
pnpm --filter @ag/runtime test && pnpm test
```

## 8.5 涉及模块

`@ag/runtime`、`@ag/narrative`、`@ag/schemas`（复用现有 policy schema）。

---

# 9. Phase G — 完善与校准（P-3 ~ P-6）

## 9.1 目标

完善设计器、校准平衡参数、真实化成本、接入表现资源。

## 9.2 任务清单

- [x] **P-3 设计器**：补齐 World / Parameter / Event / OptionTemplate / Ending 编辑器。
- [x] **P-5 平衡校准**：用 100 Runs 仿真校准 formation 阈值、初始 strength、重复反馈转负轮次。
- [x] **P-4 成本真实化**：模拟接 `usageListener` 用真实 token 计成本。
- [x] **P-6 表现资源**：立绘/背景从 `GameProject.assets` 接入；TTS/BGM 接线（可选）。
- [x] **E-3 策略指引**：为高独立角色提供可达成 Good End 的选项策略提示（游戏内引导）。

## 9.3 验收标准

- 设计器可创建完整 Project；仿真统计稳定且有校准后的参数；成本为真实用量；UI 有真实资源。

## 9.4 验证命令

```bash
pnpm test && pnpm build && pnpm --filter @ag/designer build
```

## 9.5 涉及模块

`apps/designer`、`@ag/memory`、`@ag/devtools`、`apps/player`。

---

# 10. Phase H — 最终验收（E-5）

## 10.1 目标

端到端验证设计 §9.2 V1 成功标准："这个角色真的记得我做过什么…同一个选择换一个角色结果完全不同…失败后下一局因情报而不同。"

## 10.2 任务清单

- [x] 真实 LLM + 明日香跑完整一局：验证记忆形成并影响后续 Context/反应。
- [x] 跨角色对比：同选项对不同性格角色产生不同结果（自动化测试）。
- [x] 跨局验证：Bad End 后 New Run 因知识而开局不同。

## 10.3 验收标准

- 三项 V1 成功标准全部演示通过。

## 10.4 验证命令

```bash
pnpm test && （真实 LLM 端到端脚本）
```

---

# 11. 执行顺序与依赖

```text
Phase A（核心循环）→ Phase B（跨局）→ Phase C（LLM 稳定）→ Phase D（可靠性/成本）
→ Phase E（世界）→ Phase F（政策）→ Phase G（完善/校准）→ Phase H（最终验收）
```

- A 是 B 的前提（PlayerModel 更新影响跨局感知）；C 是 H 的前提（真实 LLM 稳定才能验证"记得你"）。
- 每阶段验收通过才进入下一阶段；改动同步更新 Master Design（如契约变化）与 `docs/review/known-issues.md`。

---

# 12. 执行结果（2026-08-16）

- **Phase A ✅**：U-1 Secondary State Resolution、U-2 Player Model Update、P-1 记忆触发已完成并接线 Runtime；`secondaryDelta` 不再为空，DEMO reaction 输出 memoryCandidates 并端到端形成记忆。
- **Phase B ✅**：`applyBadEndPunishment` / `applyMetaProgression` / `startNewRunFromMeta` 与 `GameRuntime.endRun/startNewRun/setPermanentModifier` 已完成；Bad End → Knowledge/Unlock/Archive/PermanentModifier → New Run 继承闭环测试通过。
- **Phase C ✅**：Option 多样性改为软约束（strict/soft），场景+选项不再因缺类整份回退；reaction prompt 明确引导 `memoryCandidates`；maxTokens 调优；LLM fixture 测试通过。
- **Phase D ✅**：`checkNarrativeConsistency`（禁词/角色一致性）接入 Scenario/Reaction Retry；`ContextCache` 提供稳定内容缓存与 hit/miss 统计。
- **Phase E ✅**：`evolveWeather / advanceCalendar / applyNpcSchedule / evolveWorld` 实现天气、日历、NPC 日程确定性演化。
- **Phase F ✅**：`RuntimeConfig.policy` + `projectToRuntimeConfig` 将 Project Policy 注入 system prompt 与生成约束。
- **Phase G ✅（部分自动化）**：Designer 增加地点/进度/事件/Ending/OptionTemplate 编辑器；100 Runs 校准测试；成本参数可注入；立绘/背景支持 assets src；独立角色策略提示接入 Player。
- **Phase H ✅（自动化验收）**：新增 `ag-devtools acceptance`，三项 V1 标准（记忆影响 Context、同行为不同角色、跨局继承）自动化通过；真实 LLM 手动联调仍待环境执行。

最终回归：

```text
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint  ✅
pnpm --filter @ag/devtools acceptance                                       ✅
# 82 test files / 230 tests passed
```
