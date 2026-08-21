# AI GALGAME Framework

## 事件系统升级计划 Event Life Plan v1.1（Life Engine）

> 版本：v1.1 ｜ 依据：`AI_GALGAME_Master_Design_v1.0.md` §11（补充设计：事件系统过渡与补充规划）+ `AIgal_事件系统过渡与补充规划.md`
> 变更记录：v1.1（2026-08-21）P0 增补**过渡文段生成（旁白+对话）**、**Memory 联动三件套**、**合并调用**、**日内时间流动前置契约**与对应验收标准（对齐 Master Design v1.4 §11.2.1）。
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

消除"事件硬切"：每次事件后经过轻量 Transition（时间/地点/环境/情绪余波），并以**旁白+对话的过渡文段**自动衔接相邻选项节点；文段与前后选项、既有记忆机制产生因果联动。

## 2.2 任务清单

### A. 前置契约（先冻结，后实现）

- [ ] **日内时间流动契约**：当前 `time` 仅在跨天重置为 09:00（`progress-engine.ts`），需先冻结日内时段推进规则（如每 Turn 推进 上午→下午→傍晚→夜晚，跨天重置），更新 WorldState 相关 Schema。
- [ ] **TransitionRecord 数据契约**：`{ time, location, environment?, emotionalAftermath?, pendingIntentIds?, eventSchedule? }` + **`narrative: { narration, dialogues[] }`**（生成的过渡文段本身，供回放 / Turn Debugger / UI 展示）；写入 `TurnResult` 或独立 `transition` 字段。

### B. 确定性状态层

- [ ] **时间推进**：Turn 结束后按契约推进日内时段与日期，与 Day/DailyProgress 联动。
- [ ] **地点迁移**：事件结束后角色/玩家移动地点；地点变化作为过渡（复用 `@ag/world` 的 `LocationState`）。
- [ ] **环境演化**：天气/光线/人流/安静喧闹在过渡中变化（复用 `evolveWeather` / `advanceCalendar`，Phase E 已就绪）。
- [ ] **上下文传递**：Transition 输出下一事件的候选上下文（地点/时间/事件/意图），供 P5 调度器消费。

### C. 过渡文段生成（表现层，对齐 Master Design §11.2.1）

- [ ] **情绪余波（记忆驱动）**：从上一轮结果（`lastTurn.reaction / secondaryDelta / newMemories`）+ 检索 Top-K 相关记忆生成"回味"素材——回味内容必须可追溯到上一轮选择结果或某条历史记忆，禁止无因果空降。
- [ ] **generateTransition（@ag/narrative）**：输入 = 上轮摘要 + 检索记忆 + 时间/地点/环境变化；输出 = 旁白 `narration` + 角色对话 `dialogues[]`（双通道结构化校验）；无 LLM 时确定性模板 fallback（守住 §9.1 纯文本闭环验收基线），产物标记 `source: 'llm' | 'fallback'`。
- [ ] **合并调用（LLM Call Minimization）**：默认将过渡段并入下一次 Scenario 调用 prompt（要求先输出过场文段再输出场景），保持每 Turn 2 次调用不变；独立第 3 次调用仅作为可选配置项。
- [ ] **Memory 联动三件套**：① 过渡前检索 Top-K 相关记忆作素材；② 被文段实际引用的记忆触发 `reinforceMemoryRecord`；③ "回想"行为本身产出 `memoryCandidate` 经 `formMemory` 入库。
- [ ] **Runtime 接入点**：`GameRuntime.chooseOption` commit 之后、下一轮事件选择与场景生成之前执行 Transition 管线；过渡文段经 Application API 返回给 UI。

## 2.3 验收标准

- 连续事件之间出现可见的过渡（时间/地点/环境变化），不再是"硬切"。
- 相邻两轮之间出现可读的过渡文段（旁白或对话）；无 LLM 时为模板 fallback 且不破坏 GameState。
- 文段内容可追溯：自动化断言生成 prompt 包含 `[检索记忆]` 与上轮结算摘要；fallback 时标记 `source: 'fallback'`。
- LLM 调用次数/Turn 不增加（合并路径生效）。
- 日内时间随 Turn 流动、跨天正确重置。
- Memory 联动生效：被引用记忆的 strength/retrievalCount 增加；过渡产出的 memoryCandidate 经 formMemory 入库。
- Transition 携带前序事件的因果上下文，可被下一个事件引用。

## 2.4 验证命令

```bash
pnpm --filter @ag/world test && pnpm --filter @ag/narrative test && pnpm --filter @ag/runtime test && pnpm test
```

## 2.5 涉及模块

`@ag/schemas`（transition 契约 + narrative 字段 + 日内时间）、`@ag/world`（时间/地点/环境）、`@ag/narrative`（generateTransition 与合并 prompt）、`@ag/memory`（检索素材/强化/新候选）、`@ag/runtime`（Turn 编排接入 Transition）。

## 2.6 技术设计

接口、类与实现顺序详见文末 [§11 P0 技术设计](#11-p0-技术设计接口类与实现顺序)。

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

---

# 11. P0 技术设计：接口、类与实现顺序

> 本节是 P0 的可执行技术方案，签名与现有代码库约定对齐（Zod strict、`schemaVersion: '0.1.0'`、双通道 `source: 'llm' | 'fallback'`）。

## 11.1 契约层（@ag/schemas，新文件 `src/transition.ts`）

```typescript
// 过渡对话行：narrator 表示旁白
export const transitionDialogueSchema = z
  .object({
    speakerId: z.string(), // characterId 或 'narrator' / 'player'
    text: z.string(),
  })
  .strict();

// 过渡文段（表现层）
export const transitionNarrativeSchema = z
  .object({
    narration: z.string().min(1),
    dialogues: z.array(transitionDialogueSchema),
    source: z.enum(['llm', 'fallback']),
  })
  .strict();

// 过渡记录（状态层 + 表现层）
export const transitionRecordSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    turnId: idSchema, // 本过渡所属 Turn（即其开场过场）
    time: z
      .object({
        previous: timeStringSchema,
        current: timeStringSchema,
        crossedDayBoundary: z.boolean(),
      })
      .strict(),
    location: z
      .object({
        fromLocationId: idSchema.nullable(), // 首个 Turn 无前序地点时为 null
        toLocationId: idSchema,
      })
      .strict(),
    environment: z.record(z.string(), z.union([z.string(), z.number()])).optional(), // weather/light/crowd…
    emotionalAftermath: z
      .object({
        referencedMemoryIds: z.array(idSchema), // 文段引用的记忆（Memory 联动②的依据）
        summary: z.string(), // 回味摘要
      })
      .optional(),
    pendingIntentIds: z.array(idSchema).default([]), // P1 预留，P0 恒为 []
    narrative: transitionNarrativeSchema,
  })
  .strict();

// LLM 结构化通道（合并调用内嵌于 combined 响应 / 独立调用响应）
export const transitionLlmSchema = z
  .object({
    narration: z.string().min(1),
    dialogues: z.array(transitionDialogueSchema),
    referencedMemoryIds: z.array(z.string()).default([]),
    memoryCandidate: memoryCandidateSchema.optional(), // Memory 联动③："回想"产新忆
  })
  .strict();
```

**既有契约扩展**（均为 optional 字段，旧存档兼容）：

```typescript
// turn-result.ts
turnResultSchema: { …, transition: transitionRecordSchema.optional() }

// world.ts 不改 time 格式（保持 HH:mm 字符串），日内流动由推进规则产生
```

## 11.2 Core 层：日内时间推进（`packages/core/src/progress-engine.ts`）

```typescript
export const DEFAULT_TURN_TIME_STEP_MINUTES = 30;

/** 日内时间推进的唯一权威路径；跨天仍由 advanceDay 重置为 nextDayStartTime。 */
export function advanceIntradayTime(state: GameState, stepMinutes: number): GameState;
// 同时写 run.time 与 world.time；到达 23:59 后封顶等待跨天（Day 结束仍由 DailyProgress 驱动）

// turn.ts 扩展：
export interface ResolveChoiceOptions {
  …
  /** 每 Turn 日内推进分钟数；0 关闭（兼容旧 golden）。缺省 DEFAULT_TURN_TIME_STEP_MINUTES。 */
  turnTimeStepMinutes?: number;
}
// applyChoiceToState：crossedDayBoundary === false 时调用 advanceIntradayTime
```

## 11.3 Narrative 层：过渡文段生成（`packages/narrative/src/transition-generator.ts`）

```typescript
export interface TransitionContextInput {
  npcName: string;
  lastTurn?: {
    // 来自 runtime.lastTurn（内容承接：引用上一选择的结果）
    optionActions: string[];
    reactionSummary: string; // reaction.narrative 截断 + secondaryDelta 摘要
    newMemoryContents: string[];
  };
  retrievedMemories: MemoryRecord[]; // Memory 联动①：buildContext 的检索结果
  timeChange: TransitionRecord['time'];
  locationChange: TransitionRecord['location'];
  environmentChanges?: Record<string, string | number>;
}

export interface TransitionGeneratorOptions extends ReactionGeneratorOptions {}

export interface TransitionNarrativeResult {
  narration: string;
  dialogues: TransitionDialogue[];
  referencedMemoryIds: string[]; // 仅允许 ⊆ input.retrievedMemories 的 id（引擎校验过滤）
  memoryCandidate?: MemoryCandidate;
  source: 'llm' | 'fallback';
}

/** 独立生成路径（可选第 3 次调用）；默认走 §11.4 合并路径。 */
export async function generateTransition(
  input: TransitionContextInput,
  gateway: LLMGateway,
  options: TransitionGeneratorOptions = {},
): Promise<TransitionNarrativeResult>;

export function fallbackTransition(input: TransitionContextInput): TransitionNarrativeResult;
// 模板示例：「（{time.current}，{location}）{environment 一句}……{角色}似乎还在想着刚才的事。」
```

**Prompt 要点**：systemRules 复用 `context.systemRules`；user 消息包含 `[上一轮]`（optionActions/reactionSummary）、`[检索记忆N]`（id+content）、`[时间/地点/环境变化]`；要求输出严格 JSON（transitionLlmSchema），并声明"旁白描写环境与时间流逝，对话表现角色的余波情绪；若检索记忆与本过渡相关，用 referencedMemoryIds 标注并在文段中自然呼应"。

## 11.4 合并调用（`packages/narrative/src/combined-generator.ts`，默认路径）

```typescript
combinedGenerationSchema = z.object({
  transition: transitionLlmSchema.optional(),   // LLM 缺失时回退 fallbackTransition
  scenario: generatedScenarioSchema,
  options: z.array(plannedOptionSchema).min(1),
}).strict();

CombinedGeneratorOptions {
  …
  transition?: TransitionContextInput;           // 提供则 prompt 追加过场要求
}
ScenarioOptionsResult {
  …
  transition?: TransitionNarrativeResult;        // 与 scenario 同 source
}
// buildCombinedRequest 在消息首部追加：
// 「在场景之前先输出 transition 段：旁白+对话的过场文段，衔接上一轮结果与本场景。」
```

**调用次数不变：每 Turn 仍为 2 次（combined + reaction）。**

## 11.5 Runtime 管线（`packages/runtime/src/game-runtime.ts`）

```typescript
GameRuntime 新增私有成员：
  private pendingTransition?: TransitionRecord;

startTurn() 管线（事件选择之后）：
  ① buildContext(...)                                  // 检索素材（recency 已激活）
  ② generateScenarioAndOptions(..., { transition: toTransitionInput(lastTurn, context, changes) })
  ③ 组装 TransitionRecord：状态字段（time/location/environment）由 runtime 记账，
     narrative 用 combined 结果（或 fallbackTransition）
  ④ Memory 联动②：referencedMemoryIds 过滤（⊆ 检索集）后逐条 reinforceMemoryRecord(next, id, day)
     —— 注意与 #14 冷却协同：同日重复引用不重复强化
  ⑤ Memory 联动③：transition.memoryCandidate → formMemory(next, candidate, cognition)
  ⑥ this.pendingTransition = record；this.state = next

chooseOption()：
  transaction.setTransition(this.pendingTransition)    // 新 setter，镜像 setReaction
  commitTurn() 后 this.pendingTransition = undefined

视图扩展：
  StartTurnView { …, transition?: TransitionRecord }   // UI 在选项列表前渲染过场
  ChooseTurnView { …, }                                // 不变（transition 已入 TurnResult）
```

`TurnTransaction` 扩展：`setTransition(record: TransitionRecord): void`（镜像 `setReaction`，commitTurn 时写入 `TurnResult.transition`）。

## 11.6 UI（apps/player，最小改动）

- `components/TransitionPanel.tsx`：渲染 `narration`（斜体/居中样式）与 `dialogues`（说话人名 + 台词）；props `{ transition }`。
- `App.tsx`：`startTurn` 返回的 `transition` 存入 state，置于 NarrativePanel 之上；打字机复用 Typewriter。

## 11.7 devtools（验证工具）

- `live-verify.ts`：perTurn 增加 `transitionSource`、`transitionReferencedMemories` 两列；summary 增加 transitionLlmRatio。
- P0 完成后重跑真实 LLM 30 Turn，对照 §2.3 验收标准出报告。

## 11.8 实现顺序（7 步，每步含测试）

| 步骤 | 内容                                                                    | 测试                                                                                                            | 依赖  |
| ---- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| S1   | schemas：`transition.ts` 三契约 + TurnResult.optional 扩展              | schema parse/round-trip                                                                                         | —     |
| S2   | core：advanceIntradayTime + resolveChoice 接线（`turnTimeStepMinutes`） | core 单测：日内推进/封顶/跨天重置/step=0 关闭                                                                   | S1    |
| S3   | narrative：generateTransition + fallbackTransition（独立路径）          | fixture LLM 解析、非法 JSON→retry→fallback、referencedMemoryIds 白名单过滤                                      | S1    |
| S4   | combined 合并路径：schema/prompt/result 扩展                            | prompt 含过场要求；LLM 缺 transition 时降级不失败                                                               | S3    |
| S5   | runtime 管线：pendingTransition/setTransition/Memory 三件套/视图扩展    | 全链路单测：transition 入 TurnResult、被引用记忆被强化（受冷却约束）、memoryCandidate 入库、调用次数仍为 2/Turn | S2+S4 |
| S6   | player：TransitionPanel + App 接线                                      | 渲染测试（jsdom）                                                                                               | S5    |
| S7   | devtools：live-verify 增强 + 真实 LLM 30 Turn 复验报告                  | 对照 §2.3 七条验收标准逐项打勾                                                                                  | S5    |

## 11.9 兼容性影响与风险

- **Golden/simulate 指纹变化**：S2 时间流动改变确定性仿真轨迹——golden 测试为同 seed 自比较，不受影响；simulate 统计基线需在 P0 验收时重新采集一次。
- **旧存档兼容**：transition 为 optional；旧档 load 后首个 startTurn 无 lastTurn/pendingTransition，走 null 分支（fromLocationId=null、无余波）。
- **冷却协同**：过渡强化与 #14 冷却共用 `reinforceMemoryRecord`，同日多次引用天然去重。
- **prompt 长度**：combined 消息增加过渡要求与记忆行，maxTokens 维持 1536 观察截断率；必要时升到 1792。
