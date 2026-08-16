# AI GALGAME Framework
## 事件系统升级计划 Event Life Plan v1.0（Life Engine）

> 版本：v1.0 ｜ 依据：`AI_GALGAME_Master_Design_v1.0.md` §11（补充设计：事件系统过渡与补充规划）+ `AIgal_事件系统过渡与补充规划.md`
>
> 本计划是**下一阶段改进方向**：把当前已成立的 Event Engine 升级为 **Life Engine**。每阶段有目标、任务清单、验收标准与验证命令，验收通过后进入下一阶段。
> 状态标记：⬜ 未开始 / 🔄 进行中 / ✅ 已完成。

---

# 0. 文档定位

- **背景**：Phase 0.5–12 与 Completion Plan A–H 已完成，事件闭环（场景→选项→行为→AI反应→状态→记忆→Ending→跨局）成立。真实 LLM 长对话验证了"角色记得你 + 关系随互动成长"。
- **问题**：事件之间缺乏中间层，体验是 `Event A → Event B → Event C` 的"事件硬切"，而非连续、可变化、可自我运行的角色生活。
- **目标**：从"玩家触发事件"升级为"**与一个会持续生活和变化的角色共同经历时间**"。
- **实现优先级（来自补充设计 §12）**：P0 Transition → P1 Pending Intent → P2 Autonomous Event → P3 Micro Event → P4 Relationship Narrative State → P5 Event Scheduler。

---

# 1. 总体目标：从 Event Engine 变成 Life Engine

```text
                    AIgal Life Engine
                         World
              ┌───────────┼───────────┐
              ↓           ↓           ↓
            Time      Location    Environment
              └───────────┼───────────┘
                          ↓
                   Character State
              ┌───────────┼───────────┐
              ↓           ↓           ↓
           Memory     Desire    Relationship
              └───────────┼───────────┘
                          ↓
                   Pending Intent
                          ↓
                   Event Scheduler
              ┌───────────┼───────────┐
              ↓           ↓           ↓
        Main Event   Side Event  Micro Event
              └───────────┼───────────┘
                          ↓
                    Player Choice → AI Response → State/Memory Update → Narrative Consequence → 下一轮
```

## 1.1 验收目标（最终）

不再出现：

```text
事件 A → 万能场景模板 → 事件 B
```

而是出现：

```text
昨天发生了一件事 → 角色产生心理变化 → 角色形成新意图 → 第二天角色仍然记得
→ 角色可能主动行动 → 玩家响应 → 关系继续变化 → 新记忆 → 未来事件再次引用
```

---

# 2. Phase P0 — Transition System

- **状态**：⬜ 未开始

## 2.1 目标
消除"事件硬切"：每次事件后经过轻量 Transition（时间/地点/环境/情绪余波），让事件之间具有自然因果。

## 2.2 任务清单
- [ ] **TransitionRecord 数据契约**：`{ time, location, environment?, emotionalAftermath?, pendingIntentIds?, eventSchedule? }`，写入 `TurnResult` 或独立的 `transition` 字段。
- [ ] **时间推进**：Turn 结束后时间流逝（下午→傍晚→次日），与 Day/DailyProgress 联动。
- [ ] **地点迁移**：事件结束后角色/玩家移动地点；地点变化作为过渡（复用 `@ag/world` 的 `LocationState`）。
- [ ] **环境演化**：天气/光线/人流/安静喧闹在过渡中变化（复用 `evolveWeather` / `advanceCalendar`，Phase E 已就绪）。
- [ ] **情绪余波**：事件后果在之后被"回味"——从事件结果生成一条轻量"回想"过渡（如"角色在晚上回想今天的谈话"）。
- [ ] **上下文传递**：Transition 生成下一事件的候选上下文（地点/时间/事件/意图），供 P5 调度器消费。

## 2.3 验收标准
- 连续事件之间出现可见的过渡（时间/地点/环境变化），不再是"硬切"。
- Transition 携带前序事件的因果上下文，可被下一个事件引用。

## 2.4 验证命令
```bash
pnpm --filter @ag/world test && pnpm --filter @ag/runtime test && pnpm test
```

## 2.5 涉及模块
`@ag/schemas`（transition 契约）、`@ag/world`（时间/地点/环境）、`@ag/runtime`（Turn 编排接入 Transition）。

---

# 3. Phase P1 — Pending Intent

- **状态**：⬜ 未开始

## 3.1 目标
增加"角色未完成意图"，让昨天发生的事情影响明天（Intent ≠ Memory）。

## 3.2 任务清单
- [ ] **PendingIntent 数据契约**：`{ id, priority, conditions, preferredLocations, preferredTime, latestTriggerDay, createdAt, status }`。
- [ ] **意图产生**：事件/结算后，从 `PlayerModel` 更新与事件结果生成角色意图（如"想继续历史讨论"）。
- [ ] **意图生命周期**：产生 → 等待 → 择机触发 → 执行 → 完成/取消/转化；带优先级、触发条件、最晚触发时间、适合地点/时间段。
- [ ] **触发判断**：事件选择时，若满足条件的 Pending Intent 存在，提高对应事件权重（供 P5）。
- [ ] **意图完成机制**：Intent 被触发执行后标记完成；超时/条件消失则取消或转化。

## 3.3 验收标准
- 角色因前一天事件形成意图，次日择机触发为新事件；意图不机械每轮执行。
- 模拟测试：意图产生 → 触发 → 完成 的完整生命周期。

## 3.4 验证命令
```bash
pnpm --filter @ag/runtime test && pnpm --filter @ag/devtools test && pnpm test
```

## 3.5 涉及模块
`@ag/schemas`（intent 契约）、`@ag/memory`/`@ag/runtime`（意图产生与触发）、`@ag/world`（调度）。

---

# 4. Phase P2 — Character Autonomous Event

- **状态**：⬜ 未开始

## 4.1 目标
让角色不再是"等待输入的 NPC"，而是能**主动寻找玩家、发起话题、按记忆行动**。

## 4.2 任务清单
- [ ] **自主行为入口**：`GameRuntime` 支持"角色主动触发"路径（非玩家 startTurn）。
- [ ] **AutonomousEvent 类型**：基于 Pending Intent 与角色状态（desire/memory），角色主动发起事件。
- [ ] **记忆驱动自主**：角色按检索到的记忆主动提及过去（"昨天你说的那些话，我后来想了很久"）。
- [ ] **生成与呈现**：Autonomous Event 的生成沿用双通道 LLM + fallback；玩家看到的是"角色主动出现/搭话"。

## 4.3 验收标准
- 在玩家未主动操作时，角色能基于记忆/意图主动发起事件。
- 真实 LLM 验证：角色主动提及前一天的事并继续话题。

## 4.4 验证命令
```bash
pnpm --filter @ag/narrative test && pnpm --filter @ag/runtime test && pnpm test
```

## 4.5 涉及模块
`@ag/runtime`（自主触发）、`@ag/narrative`（自主事件生成）、`@ag/context`（记忆检索）。

---

# 5. Phase P3 — Micro Events / Life Events

- **状态**：⬜ 未开始

## 5.1 目标
三层事件结构（Main / Side / Micro），用 Micro Event 填充大事件之间的"生活感"。

## 5.2 任务清单
- [ ] **事件层级字段**：`EventDefinition` 增加 `level: 'main' | 'side' | 'micro'`。
- [ ] **Micro Event 模板**：偶遇、一句话、短暂互动、环境变化、角色独处（不推动重大剧情，只维持世界运行感）。
- [ ] **Micro Event 生成**：可程序化（环境/位置驱动）或 LLM 生成；低权重、高频。
- [ ] **调度区分**：P5 调度器按层级分配权重（Main 低权重高影响、Micro 高权重低影响）。

## 5.3 验收标准
- 两个 Main/Side 事件之间出现 Micro Event（点头、独处看书、递茶、书签），世界有"运行感"。
- 模拟测试：事件分布包含三层。

## 5.4 验证命令
```bash
pnpm --filter @ag/world test && pnpm test
```

## 5.5 涉及模块
`@ag/schemas`（event level）、`@ag/world`（Micro 池与模板）、`@ag/narrative`（生成）。

---

# 6. Phase P4 — Relationship Narrative State

- **状态**：⬜ 未开始

## 6.1 目标
在量化数值之上增加**叙事层关系状态**（phase / impression / desire / unresolved / emotional_direction），让"数值变化转化为人格与关系变化"。

## 6.2 任务清单
- [ ] **契约扩展**：`RelationshipState` 增加 `narrative` 子结构：`{ phase, impression[], currentDesire[], unresolved[], emotionalDirection }`。
- [ ] **relationship_phase**：按数值/事件演进（陌生→认识→熟悉→信任→依赖→亲密→冲突→疏远→修复），非简单阈值，带叙事解释。
- [ ] **impression 更新**：从玩家行为推断角色印象（倾听→"愿意倾诉"、打断→"有些不耐心"），随行为变化。
- [ ] **current_desire / unresolved**：服务 Autonomous Event 与未来事件（§3/§4）。
- [ ] **emotional_direction**：记录趋势而非快照（"角色正在变成什么样"）。
- [ ] **Context 注入**：narrative 状态进入 `ModelContext`（internalState / currentState），供 LLM 生成时使用。

## 6.3 验收标准
- `affection=40` 之外，角色有可读的叙事状态（"越来越愿意向玩家倾诉"）。
- narrative 状态进入 Context 并被 LLM 生成参考；数值与叙事同步演化。

## 6.4 验证命令
```bash
pnpm --filter @ag/schemas test && pnpm --filter @ag/runtime test && pnpm test
```

## 6.5 涉及模块
`@ag/schemas`（relationship narrative）、`@ag/core`（phase/impression 演进）、`@ag/context`（注入）、`@ag/runtime`。

---

# 7. Phase P5 — Event Scheduler

- **状态**：⬜ 未开始

## 7.1 目标
统一调度 Main / Side / Micro / Autonomous / Transition 事件，按 `World + Character + Memory + Relationship + Intent` 动态选择。

## 7.2 任务清单
- [ ] **统一事件池**：合并 EventPool + Micro 池 + Autonomous（Pending Intent 驱动）+ Transition。
- [ ] **动态权重**：权重受 trust / affection / conflict / stress / security / memory / relationship_phase / pending_intent / recent_events / time / location 共同影响（示例：trust 高 + 倾诉意图 + 图书馆 + 傍晚 → Autonomous History Event 权重显著提高）。
- [ ] **事件层级分配**：Main（低权重高影响）/ Side / Micro（高权重低影响）按调度配比。
- [ ] **Transition 接入**：事件之间经过 Transition，携带上下文进入下一事件。
- [ ] **调度结果可复现**：Event 选择仍基于 RNG（Replay/Golden 可用）。

## 7.3 验收标准
- 一次 Run 中，Main / Side / Micro / Autonomous / Transition 事件自然交织，形成连续生活流。
- 动态权重使角色意图、时间、地点正确影响事件选择；可复现。

## 7.4 验证命令
```bash
pnpm --filter @ag/world test && pnpm --filter @ag/devtools test && pnpm test
# 手动：真实 LLM 长对话，观察事件流是否连续、角色是否主动
```

## 7.5 涉及模块
`@ag/world`（调度器）、`@ag/runtime`（编排）、`@ag/core`（规则）、`@ag/narrative`（生成）。

---

# 8. 核心设计原则（贯穿实现）

1. **不要为了填充而填充**：过渡的意义是建立因果连续性，而非增加文本量。
2. **Memory ≠ Intent**：两者分离（过去 vs 现在想做什么）。
3. **数值 ≠ 人格**：数值变化逐渐转化为人格和关系变化（P4）。
4. **玩家不是唯一行动者**：角色拥有自主行为（P2）。
5. **不是所有事件都需要玩家选择**：生活包含主/小/自动/过渡/环境事件（P3）。
6. **事件应该产生后果**：`Event → Memory → State → Intent → Future Behavior`（P1）。

---

# 9. 最终验收标准

下一阶段完成后，AIgal 应能出现：

```text
昨天发生了一件事 → 角色产生心理变化 → 角色形成新的意图 → 第二天角色仍然记得
→ 角色可能主动采取行动 → 玩家可以响应 → 关系继续变化 → 产生新的记忆 → 未来事件再次引用
```

最终达到：

> **玩家不是在"触发事件"，而是在"与一个会持续生活和变化的角色共同经历时间"。**

---

# 10. 执行顺序与依赖

```text
P0 Transition → P1 Pending Intent → P2 Autonomous Event → P3 Micro Event → P4 Relationship Narrative State → P5 Event Scheduler
```

- **P0 是基础**：没有 Transition，Autonomous/Micro 无从衔接。
- **P1 → P2 依赖**：Autonomous Event 需要 Pending Intent 作为触发源。
- **P3 依赖 P0**：Micro Event 需要 Transition 提供的生活流。
- **P4 与 P1/P2 互馈**：narrative state（desire/unresolved）驱动意图，意图反馈到叙事状态。
- **P5 收口**：统一调度所有事件层级。
- 每阶段验收通过才进入下一阶段；契约变更同步更新 Master Design §11 与 `docs/review/known-issues.md`。
