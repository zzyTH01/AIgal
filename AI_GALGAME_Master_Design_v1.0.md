# AI GALGAME Framework
## 总设计文档 Master Design v1.0（唯一权威基线）

> 版本：v1.0 ｜ 状态：设计基线（可据此进入开发） ｜ 语言：中文
>
> 本文档是对此前六份 v0.1 设计文档的分析、综合与定案，是项目**唯一的权威设计基线**。
> 旧文档已归档至 `docs/design-history/`，仅供追溯设计过程，不再作为实现依据。

---

# 0. 文档定位与使用说明

## 0.1 本文档是什么

本文档不是旧文档的拼接，而是对以下六份文档的**分析、提炼与最终裁决**：

- `Project Master Design` —— 总蓝图、路线图
- `Project Design` —— 项目构思、Game State 早期设计
- `Software Architecture` —— 分层架构、数据所有权
- `Data Contract GameState` —— GameState 等核心数据契约
- `Turn Lifecycle` —— Turn 生命周期、原子事务
- `Option System & Feedback Framework` —— Option 系统、反馈闭环

分析得到的核心结论：

1. 六份文档在理念上**高度一致**，不存在原则性冲突；差异只在于细节详略与表述先后。
2. 项目真正的灵魂是**一个闭环**（状态 → AI → 选项 → 玩家 → 结算 → 记忆 → 上下文 → AI），而非任何单一模块。
3. 全部设计的**第一约束**是：`AI 负责提出与演绎，确定性引擎负责验证与结算`。一切模块划分、数据契约、异常处理都围绕它展开。

## 0.2 阅读路径

| 你的角色 | 必读章节 |
|---|---|
| 实现 Game Core / State Resolver | §2、§4、§5 |
| 实现 Narrative / Option / Memory / Context | §2、§3、§4.10、§5 |
| 实现 UI / Adapter | §1.3、§5.5、§5.6、§5.7 |
| 游戏设计师（内容、平衡） | §1、§2、§4、§6、§9 |
| 全部开发执行者 | 通读 + `DEVELOPMENT_PLAN.md` |

## 0.3 变更规则

- 本文档为唯一事实来源；旧文档不再修改。
- 任何设计变更必须回到本文档，并同步更新开发计划。
- 涉及数据契约的变更必须同时更新对应 Schema（见 §4.12）。

---

# 1. 项目定义与设计哲学

## 1.1 项目定义

> **AI GALGAME Framework**：一个以 SillyTavern 为可选 AI Runtime、以 GALGAME 式选择交互为表现形式、以 Game State 为核心、以 AI 动态叙事 + Roguelike 机制驱动的 AI 叙事游戏框架。

它同时是四种东西的集合：

```text
AI GALGAME Runtime      —— 运行游戏的引擎
AI GALGAME Designer     —— 创建角色/世界/规则的设计器
Character Creation System —— 角色模板与迁移编译器
Roguelike Narrative Engine —— 失败→情报→再挑战的叙事模拟器
```

## 1.2 本质区别：从"剧本树"到"规则沙盒"

传统 GALGAME：

```text
作者 → 固定剧情树 → 玩家选择 → 少量分支 → 固定结局
```

本项目：

```text
作者 → 世界规则 + 角色规则 + 参数规则
     → AI 在规则内动态生成事件与选项
     → 玩家选择 → 状态变化 → AI 依据新状态生成下一轮
     → 持续循环 → 结局是状态演化的自然结果
```

**作者定义的是世界的"物理定律"，AI 是定律约束下的叙事生成器，玩家是在沙盒中行动的观察者与塑造者。**

因此项目更接近 **Narrative Sandbox / Dynamic Narrative Simulation**，而不是传统 Visual Novel。核心判断标准（V1 成功标准）：*"这个角色真的记得我做过什么，她现在对几天前的事做出反应；同一个选择换一个角色结果完全不同；这一局失败后，下一局因为我知道了某些东西而不同。"*

## 1.3 产品形态：三种模式

```text
                AI GALGAME Framework
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
     Designer        Runtime        Player
     创建游戏         运行游戏        玩游戏
```

- **Design Mode**：创建角色、编辑世界/参数/事件/选项规则/Ending/Prompt、测试 AI、模拟 Run。
- **Play Mode**：开始 Run、阅读剧情、选择行为、查看状态、存档、抵达 Ending、开始下一 Run。
- **Debug / Simulation Mode**：单 Turn 调试、状态/Memory/Context 检查、RNG Replay、批量模拟、AI 输出验证、平衡测试。

## 1.4 六条核心设计原则（含"为什么"与"怎么落地"）

### ① 固定规则，而不是固定剧情
- **为什么**：固定剧情树无法支撑"重复可玩 + 角色记忆 + 状态演化"；只有规则固定、剧情动态，才能让每次 Run 不同。
- **落地**：不设主线剧情树；剧情是 `状态 + 事件池 + RNG + AI` 的涌现结果。所有"剧情"都是 `WorldEventState` / `EventInstance`，有权重、条件、冷却。

### ② 玩家选择的是行为，而不是台词
- **为什么**：台词是"表现"，行为是"逻辑"。只有行为可被规则引擎结算、可被记录、可产生可计算的反馈。
- **落地**：Option 是结构化 **Behavior Object**（§4.10）。玩家看到自然语言，引擎处理 `behavior/intent/tone/risk`。UI 无输入框。

### ③ AI 负责表现，规则引擎负责真实状态
- **为什么**：LLM 是概率性、不可靠的；关系数值、Ending、存档等必须是确定性的，否则游戏会"失去规则"。
- **落地**：AI 输出一律**双通道**（自然语言给玩家 + 结构化数据给引擎）；引擎对结构化数据做 Schema 校验、数值校验、Clamp；非法值**忽略 AI 数值并用规则重算**（§3.3）。

### ④ 角色记住什么，决定角色如何理解现在
- **为什么**：这是角色"像人"的来源。每次读全部历史不可行也无聊；记忆的缺失与偏差才塑造人格。
- **落地**：Memory 与 Context 是两套系统（§4.8、§5.2）。角色有认知参数（`memoryCapacity/encoding/retention/retrieval/forgetfulness/grudge/obsession/attention`），决定哪些记忆进入本轮 LLM Context。

### ⑤ 失败不是终点，而是下一次 Run 的情报
- **为什么**：Roguelite 的核心循环是"失败 → 获得信息 → 下一局利用信息"。失败必须有价值，游戏才有重玩动力。
- **落地**：Bad End → Bad End Narrative → Punishment（Debuff/记忆/知识/解锁/Ending 归档/永久修正）→ Meta Progression（跨 Run 保留 `MetaState`）→ New Run。

### ⑥ SillyTavern 是 Runtime，不是游戏本体
- **为什么**：把游戏规则绑死在特定运行时，会导致不可迁移、不可独立运行、不可调试。
- **落地**：SillyTavern 是 **Adapter**（§5.7），`Game Core` 永远不感知它。Character Card 是"导出格式"，不是内部唯一角色格式。

## 1.5 第一版产品边界

**V1 必须具备**（文本可玩的完整闭环）：

```text
LLM Runtime 接入 ｜ Character Card / World Book ｜ 选项式交互 ｜ AI 动态生成场景
AI 动态生成选项 ｜ State Resolver ｜ 关系参数 ｜ 角色心理 ｜ Daily Progress
Day 系统 ｜ 随机事件 ｜ Memory ｜ Context Builder ｜ Good/Normal/Bad Ending
Punishment / Meta Progression ｜ Run ｜ Save/Load ｜ Export ｜ Character Creator
Design Mode ｜ Simulation Mode
```

**V1 暂不作为核心**（表现层后置）：Live2D、高级 CG、复杂立绘动画、全语音、大规模地图、战斗系统、本地模型部署平台、大规模多人网络同步。

---

# 2. 核心玩法模型

## 2.1 反馈闭环（项目真正的核心）

```text
World State → Character State → Relationship State
   → AI Director → Scenario → Option Generator → Player
   → State Resolver → Character/Relationship/World Update
   → Memory Engine → Context Builder → LLM → New Scenario
```

**这个闭环是项目的灵魂。** 每一环的输出是下一环的输入，状态永远在演化，AI 永远在"当前状态允许的空间"里生成。任何模块的设计都必须回答：*它在这个闭环中处于哪个位置，它的输入输出是什么。*

## 2.2 四级时间结构

```text
Run ── Day ── Event/Scene ── Turn ── Player Choice
```

- **Run**：一局完整游戏生命周期。
- **Day**：游戏世界中的一天，由 Daily Progress 推动。
- **Event / Scene**：当前具体情境（叙事容器，不是章节）。
- **Turn**：最小执行单位，玩家完成一次选择 + 一轮完整反馈循环。

## 2.3 Turn = 原子叙事事务

**定义**：Turn 是原子叙事事务（Atomic Narrative Transaction）—— 读取当前世界/角色/关系/记忆状态，选择并生成一个情境与若干行为选项，玩家选择，规则引擎结算直接状态变化，AI 依据结果生成角色反应，规则引擎再处理二次反馈，随后形成/强化记忆、更新玩家模型与世界状态，进行 Day/Ending 检查，最终将新状态原子提交。

**18 阶段生命周期**：

```text
01 State Snapshot → 02 World Tick → 03 Event Selection → 04 Context Assembly
→ 05 Scenario Generation → 06 Option Planning → 07 Option Realization
→ 08 Player Choice → 09 Choice Resolution → 10 NPC Reaction
→ 11 Secondary State Resolution → 12 Memory Formation → 13 Player Model Update
→ 14 World/Relationship Update → 15 Day/Ending Check → 16 Memory Consolidation
→ 17 Save Commit → 18 Next Turn
```

**事务性**：整个 Turn 按 `Read → Compute → Generate → Validate → Commit` 执行。任何阶段失败 → **Rollback 到 State Before Turn**。禁止"AI 输出一句就立刻改状态"的边算边写模式。

**各阶段执行归属**：

| 阶段 | 执行方 |
|---|---|
| 02/03/09/11/13/14/15/17/18 | 确定性引擎 |
| 05/06/07/10 | LLM 生成（经引擎校验） |
| 04/12/16 | Memory / Context 服务 |
| 17 | Persistence |

## 2.4 Day 与 Daily Progress

Daily Progress（日程进度）是"生活时间的消耗/推进"，不是 RPG 能量值。

- 不同行为消耗不同：普通聊天 +1、陪伴 +2、认真帮助 +3、冲突 +1、重大事件 +4、特殊活动 +5、独处/休息 +0。
- 达到 `dailyProgressLimit` 即进入 Day End：`Daily Summary → Memory Consolidation → Ending Check → Night Phase → Day + 1`。
- **允许"浪费一天"**：玩家可独处、暂不接近角色、消极行为、主动制造风险——这都是合法策略。

## 2.5 Roguelike Run 与 Meta Progression

每次 Run 独立初始化：Random Seed、World State、Character State、Relationship State、Event History。
跨 Run 保留：Knowledge、Meta Memories、Unlocks、Achievements、Ending Archive、Permanent Modifiers（全部存于 `MetaState`）。

```text
Run #001 → 随机世界 → 随机事件 → 动态选项 → 玩家选择 → Ending
   → Bad End → Punishment → 获得情报 → Run #002（携带情报重来）
```

## 2.6 事件系统与涌现剧情

**事件不是故事，而是叙事容器。** 事件向 AI 提供：事件类型、世界条件、角色条件、行为约束、关系状态；AI 据此生成具体故事。因此保持"非固定剧情树 + 动态世界 + AI 驱动"。

事件类别：`Daily / Social / Exploration / Conflict / Romantic / Special / World / Rare`。

事件选择：

```text
EventScore = BaseWeight × ContextModifier × CharacterModifier × RelationshipModifier × RandomFactor
```

未来加入稀有度（Common/Uncommon/Rare/Legendary）形成 Roguelike 事件池。

---

# 3. AI 与引擎职责边界（最硬的原则）

## 3.1 职责清单

| AI 可以负责（提出与演绎） | 引擎必须负责（验证与结算） |
|---|---|
| 当前场景是什么 | Day / Time / Daily Progress |
| NPC 怎么说、如何自然反应 | Affection / Trust / Intimacy 等最终数值 |
| 动态事件描述 | 角色参数 / Psychology 最终值 |
| 候选行为选项 | Flags / Ending 判定 |
| 角色情绪/意图的结构化判断 | RNG / Save / Load |
| Memory Candidate | Memory 的最终写入 |
| 玩家行为的潜在解释 | 数值上下限 / 合法性 / Rollback |

> **铁律：AI 可以提出结果，但 State Resolver 才能确认结果。** LLM 不可以直接写 `affection = 80`；它只能提议 `affection +3`，由 Resolver 决定最终值。

## 3.2 AI 双通道输出

一次 LLM 调用的返回分为两个通道：

```jsonc
{
  // Natural Language Channel —— 给玩家
  "narrative": "谢谢……其实我今天不太想一个人。",
  // Structured Channel —— 给游戏引擎
  "emotion":      { "type": "relief", "intensity": 0.7 },
  "intent":       { "type": "seek_closeness", "intensity": 0.5 },
  "memory_candidate": true
}
```

引擎只消费 Structured Channel，且经 Schema + 数值 + 状态三重校验。

## 3.3 AI 可靠性层

必须假设 **LLM 会犯错**。对每次 LLM 输出依次执行：

```text
Schema Validation → Constraint Validation → State Validation → Narrative Consistency Check → Retry → Fallback
```

| 故障 | 处理 |
|---|---|
| JSON 非法 | Parse Error → Retry → 仍失败 → Fallback 模板 |
| 非法数值（如 `affection_change: 5000`） | 忽略 AI 数值 → 用游戏规则重算 |
| 选项不符合角色设定 | Character Constraint Validation → Regenerate |
| 中途出错 | 事务回滚到 State Before Turn |

---

# 4. 领域模型（数据契约）

## 4.1 数据契约的设计原则

1. **状态值 ≠ 历史事件**：`affection = 63` 是状态；`AffectionChanged{before:60, after:63, source:"turn_124"}` 是事件/历史。核心 State 只存状态。
2. **GameState 是数据，不是业务逻辑**：规则由 Engine/Service 实现。
3. **GameState ≠ LLM Context**：Context 是对每次 LLM 调用动态构建的派生数据（§5.2）。
4. **Schema 是单一事实来源**（§4.12）。
5. **所有 0~100 百分比参数的上下界由 Schema 保证**（`Percent: 0~100`）。

## 4.2 GameState 根结构

```typescript
interface GameState {
  schemaVersion: string;                                     // "0.1.0"
  run: RunState;
  world: WorldState;
  characters: Record<CharacterId, CharacterState>;
  relationships: Record<RelationshipId, RelationshipState>;
  flags: Record<string, boolean | number | string>;
  playerModel: PlayerModel;
  memories: MemoryState;
  meta: MetaState;
  rng: RNGState;
}
```

**四句话概括核心 State**：

- CharacterState：*她是谁，以及她现在是什么状态。*
- RelationshipState：*我和她之间是什么状态。*
- WorldState：*世界现在是什么状态。*
- GameState：*这一局游戏此刻的完整状态。*

## 4.3 RunState

```typescript
interface RunState {
  runId: RunId; startedAt: string;
  day: number; turn: number; time: string;                    // time: "HH:mm"
  dailyProgress: number; dailyProgressLimit: number;
  currentEventId?: EventId; currentLocationId: string;
  status: "not_started" | "active" | "paused" | "ending" | "completed" | "bad_end";
}
```

## 4.4 CharacterState

角色是**动态系统**，不是静态 Character Card。由八部分构成：

```typescript
interface CharacterState {
  characterId: CharacterId;
  identity: CharacterIdentity;      // name/age/gender/genderIdentity/sexualOrientation/role/description
  personality: PersonalityState;    // 长期稳定：traits、independence、confidence、sociability、sensitivity、assertiveness、empathy、openness
  psychology: PsychologyState;      // 随互动变化：dependence、security、loneliness、stress、jealousy、selfWorth、emotionalStability、romanticTension
  emotion: EmotionState;            // 短期动态：primary/secondary、intensity(0~100)、valence(-100~100)、energy(0~100)
  cognition: CognitionState;        // memoryCapacity、encoding、retention、retrieval、forgetfulness、grudge、obsession、attention、emotionalSalience、cognitiveLoad
  physical: PhysicalState;          // energy、fatigue、health、hunger、sleepiness
  activity: CharacterActivityState; // locationId、activity、availability、scheduleState、currentGoal
  status: "active"|"unavailable"|"absent"|"asleep"|"disabled";
}
```

**三个必须区分的概念**：

| 概念 | 含义 | 例 |
|---|---|---|
| Personality | 长期人格倾向 | `independence = 80` 指"她本性独立" |
| Psychology | 当前关系环境下的心理 | `dependence = 70` 指"她现在很依赖你" |
| Cognition | 认知/记忆能力 | `memoryCapacity` 是**抽象认知能力，不是 LLM 真实 Context Window** |

**activity 的意义**：防止不符合世界状态的生成（如角色正在考试却出现在咖啡厅聊天）。

## 4.5 RelationshipState

关系是**两个实体之间**的状态，不是某角色自身状态：

```typescript
interface RelationshipState {
  relationshipId: RelationshipId;
  sourceId: CharacterId; targetId: CharacterId;
  type: RelationshipType;           // unknown/stranger/acquaintance/friend/close_friend/romantic_interest/partner/family/rival/enemy/estranged/custom
  affection: number; trust: number; intimacy: number; familiarity: number;
  attraction: number; conflict: number; respect: number; dependency: number;
  currentLabel?: string;            // 如 "暧昧对象"
  tags: string[]; status: "active"|"strained"|"broken"|"ended";
  customMetrics?: Record<string, number>;
}
```

**关键设计判断**：不是所有关系都用全部指标——普通朋友用 `trust/familiarity/respect`，恋爱用 `affection/trust/intimacy/attraction`，对立用 `conflict/respect`。`customMetrics` 为 Character Creator 提供可扩展参数。`Affection=80, Trust=20` 意为"很喜欢你，但不相信你"，不等于恋爱关系。

## 4.6 WorldState

```typescript
interface WorldState {
  day: number; time: string; weekday: Weekday; season: Season;
  weather: WeatherState;            // type/intensity/temperature/visibility
  currentLocationId: string;
  locations: Record<string, LocationState>;   // type/tags/accessibility/active/currentCharacters
  publicEvents: WorldEventState[];
  activeEvents: WorldEventState[];
  worldFlags?: Record<string, boolean|number|string>;
}
```

世界是有规则的随机世界：**在固定世界规则与可用空间内随机采样事件**（图书馆偏向阅读/学习/安静聊天/偶遇；天台偏向独处/深谈/关系事件/冲突）。

## 4.7 PlayerModel —— 角色对玩家的主观认知

```typescript
interface PlayerModel {
  perceivedTraits: Record<string, number>;
  perceivedIntentions: Record<string, number>;
  behavioralPatterns: Record<string, number>;   // player_help: 7, player_flirt: 3 ...
  recentBehaviorPattern: string[];               // ["help","help","help"]
  reliability: number; honesty: number; caring: number;
  confidence: number; romanticInterest: number; perceivedControl: number;
}
```

> **PlayerModel 不是玩家的客观属性，而是角色认为玩家是什么样的人。** 不同角色对同一行为可形成完全不同的判断（例："你早点回去休息吧" → A 认为关心 / B 认为不想待 / C 认为又在替我做决定）。重复行为会进入 `recentBehaviorPattern`，用于产生边际收益递减甚至负反馈（"你最近是不是过度保护我？"）。

## 4.8 Memory 系统

### 结构化 MemoryRecord（不是聊天记录）

```typescript
interface MemoryRecord {
  id: MemoryId; type: "episodic"|"semantic"|"emotional"|"social";
  content: string; createdAt: GameTimestamp;
  importance: number; emotionalIntensity: number; valence: number;
  strength: number; accuracy: number;
  tags: string[]; relatedCharacters: CharacterId[];
  sourceTurnId: TurnId; retrievalCount: number; lastRetrievedAt?: GameTimestamp;
}
```

### 生命周期

```text
Raw Event → Memory Candidate → Encoding → Short-Term → Consolidation → Long-Term → Decay → Retrieval → Reinforcement → Forget
```

### 关键算法语义（区分三个易混概念）

| 概念 | 含义 | 独立维度 |
|---|---|---|
| **Retention** | 记忆能保持多久 | "记不记得住" |
| **Grudge** | 对负面事件的长期保持与再激活 | "记不记仇" |
| **Obsession** | 特定记忆反复占据注意力 | "放不放得下" |

一个角色可以记性极好但不记仇，也可以平时健忘但唯独对某次伤害无法释怀。

- **衰减**：`S(t) = S₀·e^(−λt)`，λ 受 forgetfulness/retention/emotionalSensitivity/grudge/obsession 影响。
- **强化**：回忆本身强化记忆（0.42 → 0.68）。
- **检索评分**：`Score = w_r·Relevance + w_i·Importance + w_e·Emotion + w_s·Strength + w_o·Obsession`，取 Top-K。
- **形成阈值**：`CandidateScore = Importance × EmotionalIntensity × Novelty × CharacterMemoryFactor`，低于阈值只留 Recent Events。
- **MemoryState**：`records + shortTermIds + longTermIds + forgottenIds + lastConsolidatedDay`，显式分层。
- **未来（不进 V1）**：`accuracy` 支持错误记忆（角色按"自己的版本"理解过去）。

## 4.9 MetaState 与 RNGState

```typescript
interface MetaState {
  runCount: number; completedRuns: number;
  knowledge: Record<string, KnowledgeRecord>;
  memories: MetaMemoryRecord[];
  unlocks: string[]; achievements: string[];
  endingsDiscovered: string[]; permanentModifiers: Record<string, number>;
}
interface RNGState { seed: number; state: number[]; algorithm: string; }  // 如 xorshift128
```

**RNG 必须可复现**：同一 Run 在相同 RNG 状态下可完全复现，这是 Debug/Replay/Golden Test 的基础。

## 4.10 Option —— 行为对象

### 结构

```jsonc
{
  "id": "option_001",
  "presentation": { "text": "这次你自己试试看，我相信你。", "tone": "supportive" },
  "behavior":     { "actions": ["support","respect","encourage_independence"], "intent": ["care","encouragement"], "risk": 0.15 },
  "gameplay":     { "progress": 2 },
  "effects":      { "affection": { "base": 2 }, "trust": { "base": 4 } },   // 仅基础倾向，非最终值
  "conditions":   { "trust": { "min": 20 } },
  "generation":   { "must_fit_character": true, "must_fit_context": true, "variation": "high" }
}
```

### 两阶段生成（Gameplay 逻辑与表面语言分离）

- **Phase A — Option Planning**：AI 只规划行为类型，如 `A: support/low risk, B: flirt/medium risk, C: avoid/low risk, D: challenge/high risk`。
- **Phase B — Option Realization**：把行为转成玩家看到的自然语言（"你是不是累了？要不要我陪你一会儿？"）。

### 多样性约束

每轮至少覆盖：**主动行为 / 保守行为 / 社交关系行为 / 风险行为**。禁止四个本质相同的选项。

### 结算公式

```text
ΔX = Base × PersonalityModifier × RelationshipModifier × ContextModifier × EmotionModifier
     → 再叠加 Repetition / Risk / History / Memory Modifier
     → Clamp（0~100）→ Final State Delta
```

- **非线性反馈**：接近上下限时边际收益衰减，防止"机械刷好感"。
- **重复反馈**：`recentBehaviorPattern` 使重复行为收益递减甚至转负。
- **同行为不同结果**：`ΔS = f(B, P, C, R, W)` —— 行为 + 角色人格 + 角色状态 + 关系 + 世界共同决定结果（独立型角色 vs 依赖型角色对"我来帮你吧"反应相反）。

## 4.11 待冻结的数据契约

以下契约**尚未冻结**，是开发计划 Phase 1 的产物（按优先级排序）：

```text
Option → StateDelta → Event → TurnResult → Context → SaveSnapshot → Project → CharacterDefinition
```

其中 **StateDelta** 是连接 `Option → StateResolver → GameState` 的关键结构，需区分 `BaseDelta / Modifier / FinalDelta`，能表达 run / character / relationship / world / flags / memoryCandidates / meta 的变化。

## 4.12 Schema 作为单一事实来源

- 采用 **JSON Schema Draft 2020-12** + TypeScript 接口 + **Zod** 运行时验证。
- Schema 目录：`schemas/game-state|character|relationship|option|event|state-delta|turn-result|context|memory|save|project.schema.json`。
- **同一份 Schema 服务所有消费方**：Character Creator、Validation、Save、Import/Export、Character Card 生成、Prompt 生成、API、测试。严禁"前端一套字段、AI 一套字段、Save 一套字段"。
- **成年角色边界**：`CharacterIdentity.age >= 18`，第一版 Runtime 角色数据层只允许成年角色进入关系系统——这是为后续成熟向内容提供的**清晰数据层边界**。

---

# 5. 系统架构

## 5.1 Core + Services + Adapters（六边形架构）

```text
┌───────────────────────────────────────┐
│              EXPERIENCE               │  Player UI / Designer UI
└──────────────────┬────────────────────┘
┌──────────────────▼────────────────────┐
│              APPLICATION              │  Turn Orchestrator、Game/Narrative/Memory
│                                       │  Services、Project/Save Services
└──────────────────┬────────────────────┘
┌──────────────────▼────────────────────┐
│                 CORE                  │  GameState、Rules、StateResolver、
│                                       │  Relationship、World Rules、Ending、Schemas
└──────────────────┬────────────────────┘
┌──────────────────▼────────────────────┐
│              ADAPTERS                 │  SillyTavern、LLM Providers、File/SQLite、Web/Desktop
└───────────────────────────────────────┘
```

**依赖单向**：`UI → Application → Core → Adapters`。禁止 `GameCore → SillyTavern`、`GameCore → React`、`GameCore → LLM Provider`、`GameCore → DB`。

## 5.2 模块划分（10 大模块）

```text
1. Game Core        —— GameState/Turn/Run/Day/StateResolver/RuleEngine/ProgressEngine/EndingEngine
2. World Engine     —— Time/Calendar/Weather/Location/EventPool/WorldTick
3. Character & Relationship Engine —— Profile/Personality/Psychology/Emotion/Cognition + RelationshipGraph/Rules
4. Narrative Engine —— ScenarioGenerator/OptionPlanner/OptionRenderer/ReactionGenerator（不直接改 GameState）
5. Option Engine    —— Planner/Validator/Renderer/Scorer
6. Memory Engine    —— Store/Formation/Decay/Retrieval/Reinforcement/Consolidation
7. Context Engine   —— ContextBuilder/ContextBudget/MemoryRanker/StateSummarizer/PromptComposer → ModelContext
8. Persistence      —— Save/Load/Export
9. Runtime Adapters —— SillyTavern / LLM / UI
10. Design System   —— Character Creator / World Builder / 参数 / 事件 / 选项模板 / Ending / Prompt
```

**Memory 与 Context 必须分离**：Memory = 角色记得什么；Context = 本轮 AI 应该看到什么。Context Builder 输入 `GameState + 检索记忆 + 当前事件 + 角色认知`，输出 `ModelContext`，并根据角色认知能力做 **Cognitive Context Budget**（例：Capacity=80 → System 15 / Current State 15 / Recent Events 20 / Memories 20 / Internal 10）。

## 5.3 数据所有权（单一权威写入路径）

| 数据 | 唯一权威模块 |
|---|---|
| Day / Time | Time Engine |
| Daily Progress | Progress Engine |
| Affection / Trust 等关系数值 | State Resolver |
| Character Psychology | Character Engine + State Resolver |
| Relationship | Relationship Engine |
| World State | World Engine |
| Memory | Memory Engine |
| RNG | RNG Service |
| Ending | Ending Engine |
| Save | Persistence |
| Character Card | Character Compiler / Adapter |
| LLM Context | Context Builder |
| AI 生成文本 | Narrative Engine |

> **一个核心状态只能有一个权威写入路径。** 这是防止"状态漂移"的硬规则。

## 5.4 Application API（UI 与 Core 的唯一通道）

UI 不直接访问内部 Service：

```text
POST /game/start     POST /turn/start     POST /turn/choice
GET  /game/state     POST /save           POST /load           POST /export
```

例：`POST /turn/choice {turnId, optionId}` → `{narrative, stateDelta, nextTurn}`。UI 不需要知道 Memory、StateResolver、LLM Gateway 的内部实现。

## 5.5 LLM Gateway

Narrative Engine 不直接调用任何厂商 API：

```typescript
interface LLMGateway { generate(request: LLMRequest): Promise<LLMResponse>; }
```

支持：OpenAI、Anthropic、Gemini、OpenAI-Compatible、Local Models。切换模型不改核心逻辑。

**成本控制**（V1 就应设计）：
- LLM Call Minimization：一个 Turn 理想为 3 次调用（Scenario + Options 可合并为 1 次、NPC Reaction）。
- Context Cache：Character Definition / World Rules / Stable Personality 缓存，每轮只更新动态部分。
- 结构化状态（Affection/Trust/Day/Flags）**直接注入 Context**，不走 RAG。RAG 只用于 Memory Retrieval。

## 5.6 SillyTavern Adapter 定位

SillyTavern 是 **Runtime Adapter / Character Runtime**，负责：Character Card、World Book/Lorebook、Prompt Runtime、Context Bridge、LLM Routing、Extension 通信。

**不负责**：GameState、StateResolver、Ending、RNG、Save、Memory 逻辑。

**Character Compiler**：一份 `CharacterDefinition` 编译为 `Game Character + SillyTavern Card + World Book + Prompt`，支持双向迁移（导入/导出）。

## 5.7 事务式 Turn 与 RNG/Replay

- **Turn ID**：`run_017/day_008/turn_124`，全链路可追踪（当时发生什么、AI 看到什么、用了哪个 RNG 状态、状态如何变）。
- **Atomic Turn Transaction**：`Read → Compute → Generate → Validate → Commit`，失败即 Rollback。
- **Replay**：保存 `seed + state + algorithm`，同一 Run 可复现。
- **State Snapshot / Diff**：Full Snapshot + 每 Turn Delta 兼顾存储效率与 Replay/Rollback/Debug。

## 5.8 Persistence

- V1：**JSON + Directory**（`saves/run_017/` 下 manifest/state/memories/history/每 turn 记录/meta）。
- 后期：SQLite。
- Save 至少包含：Run ID、Day、Turn ID、State Before/After、Player Choice、NPC Reaction、State Delta、New Memories、Player Model、World Update、RNG State。

## 5.9 Project Package

**一个 Project = 一款完整的 AI GALGAME**：

```text
GameProject: project.json / characters/ / world/ / parameters/ / options/
             / events/ / endings/ / prompts/ / assets/ / saves/ / meta/
```

---

# 6. 内容与政策层

- **成年角色边界**：`age >= 18` 由 Schema 硬保证（§4.12）。
- **Project Policy**（每部作品可配置，不写死进 Core）：Age Rating、Relationship Types、Content Tags、Narrative Tone、Mature Themes、Generation Constraints。
- **LGBTQ / 性别 / 取向不是特殊模式**：是 Character Schema 的普通字段（gender/genderIdentity/sexualOrientation 用字符串，不做死 enum）。
- **设计原则**：不把成熟向内容写进 Core；同一套引擎可运行全年龄 / 成熟向 / LGBTQ+ / 悬疑 / 黑暗叙事等不同作品。内容边界、年龄评级、角色年龄与自愿关系作为正式项目规则管理。

---

# 7. 测试与可靠性策略

| 层 | 内容 |
|---|---|
| **Unit Test** | StateResolver、Modifier、MemoryDecay、EventWeight、EndingCondition |
| **Integration Test** | Turn Lifecycle、Memory+Context、LLM Gateway、Save/Load |
| **Simulation Test** | 100/1000 Runs、RNG、Ending 分布、Context Explosion |
| **Golden Test** | 固定 RNG Seed + GameState + LLM Fixture，校验输出是否符合预期 |

**AI 可靠性**（§3.3）与 **性能/成本策略**（§5.5）贯穿所有阶段。

---

# 8. 技术栈决策（最终定案）

| 层 | 选型 | 理由 |
|---|---|---|
| 核心语言 | **TypeScript** | 类型系统适配复杂 Schema；Web/Desktop 共用；JSON 友好；SillyTavern Extension 生态；Agent 编码友好 |
| UI | **React** | 生态成熟，适合 GAL UI / 设计器 |
| 验证 | **Zod + JSON Schema (Draft 2020-12)** | 运行时校验 + 数据契约单一来源 |
| 持久化 | **JSON → SQLite** | V1 简单可靠，后期可迁移 |
| LLM | **LLM Gateway** | OpenAI / Anthropic / Gemini / OpenAI-Compatible / Local |
| 工程形态 | **Monorepo + Modular** | 单一运行时、多个逻辑模块，不拆微服务 |
| 包管理/构建/测试 | **pnpm + tsup/tsc + vitest** | 现代 TS 工程标配 |

> 决策记录：设计文档自始推荐 TypeScript；当前仓库的 Python 脚手架（`pyproject.toml` / `src/tavern_gal/`）只是早期占位，**开发计划以 TypeScript 项目取代之**。详细目录见 `DEVELOPMENT_PLAN.md` §1。

---

# 9. 验收标准

## 9.1 Prototype 验收（进入 UI/表现层之前）

纯文本 Prototype 必须做到完整闭环且**至少连续运行几十个 Turn 而不破坏 GameState**：

```text
创建角色 → 创建世界 → 生成 Run → 随机事件 → AI生成场景 → 生成4个选项
→ 玩家选择 → StateResolver → NPC反应 → Memory → Context更新 → 下一Turn
→ Next Day → Bad/Normal/Good Ending → Punishment → Meta Progression → New Run
```

## 9.2 V1 成功标准

> "我感觉这个角色真的记得我做过什么，而且她现在的反应和几天前发生的事情有关；同样一个选择换一个角色可能完全不同；这一局失败以后，下一局因为我知道了某些东西而发生了变化。"

达到此标准，核心即成立；之后的立绘/CG/Live2D/TTS/BGM/华丽 UI 都只是表现层扩展。

---

# 10. 版本与演进

## 10.1 已冻结 vs 待冻结

**已冻结（v1.0 基线）**：项目定位、核心玩法、反馈闭环、四级时间结构、Turn 生命周期、职责边界、系统架构、数据所有权、GameState / CharacterState / RelationshipState / WorldState / PlayerModel / MemoryState / MetaState / RNGState、技术栈定案、验收标准。

**待冻结（开发计划 Phase 1 产物）**：Option / Event / StateDelta / TurnResult / Context / SaveSnapshot / Project / CharacterDefinition 的正式 Schema。

## 10.2 与旧文档的关系

- `docs/design-history/` 中的六份 v0.1 文档为设计过程存档。
- 若旧文档与本文档冲突，**以本文档为准**。
- 本文档 v1.0 之后的所有修订直接改本文件并递增版本号。
