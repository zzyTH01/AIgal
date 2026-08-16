# AI GALGAME Framework
## Turn Lifecycle — 完整交互流程设计
### Design Document v0.1

---

# 1. 文档目的

本文件定义 AI GALGAME Framework 中一次完整 **Turn** 的生命周期。

Turn 是游戏最核心的执行单位：

> 从玩家看到一个当前情境与若干行为选项开始，到玩家完成选择、NPC 产生反应、状态与记忆更新、Day/Ending 检查、存档提交并进入下一 Turn 为止。

本设计重点解决：

- 一个 Turn 如何开始
- 哪些阶段调用 LLM
- 哪些阶段由确定性规则引擎执行
- 玩家选择如何影响状态
- NPC 反应如何产生二次反馈
- Memory 如何形成
- Context 如何更新
- Day 与 Ending 如何检查
- 如何保证 Save/Load 的状态一致性
- 如何处理 LLM 输出异常

---

# 2. 时间层级

整个游戏采用四级时间结构：

```text
Run
└── Day
    └── Event / Scene
        └── Turn
            └── Player Choice
```

含义：

- **Run**：完整的一局游戏
- **Day**：游戏中的一天
- **Event / Scene**：当前发生的具体情境
- **Turn**：玩家完成一次选择并完成一次完整反馈循环

因此：

> **Turn 是最小的叙事与状态更新单位。**

---

# 3. Complete Turn Lifecycle

推荐 V1 采用以下生命周期：

```text
01. State Snapshot
02. World Tick
03. Event Selection
04. Context Assembly
05. Scenario Generation
06. Option Planning
07. Option Realization
08. Player Choice
09. Choice Resolution
10. NPC Reaction
11. Secondary State Resolution
12. Memory Formation
13. Player Model Update
14. World / Relationship Update
15. Day / Ending Check
16. Memory Consolidation
17. Save Commit
18. Next Turn
```

完整流程：

```text
                ┌─────────────────┐
                │  State Snapshot │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │    World Tick   │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Event Selection │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Context Builder │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │Scenario Generate│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Option Planning │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │Option Realization│
                └────────┬────────┘
                         ↓
                      PLAYER
                         ↓
                ┌─────────────────┐
                │Choice Resolution│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │  NPC Reaction   │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │Secondary State  │
                │   Resolution    │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Memory Formation│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Player Model    │
                │     Update      │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ World/Relation  │
                │     Update      │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Day/Ending Check│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │Memory Conslidate│
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │   Save Commit   │
                └────────┬────────┘
                         ↓
                    Next Turn
```

---

# 4. LLM 与 Deterministic Engine 的职责边界

整个 Turn 分为四类工作：

```text
A. Deterministic Engine
B. LLM Generation
C. Memory / Retrieval
D. Persistence
```

## 4.1 Deterministic Engine

必须由程序执行：

- 时间推进
- Daily Progress
- 参数计算
- 状态上下限
- 条件检查
- FLAG
- RNG
- Ending
- Bad End
- Save
- Load
- 数据合法性检查
- Rollback

## 4.2 LLM Generation

由模型负责：

- 场景描述
- NPC 自然语言
- 动态事件内容
- 动态选项
- NPC 反应
- 情绪/意图结构化判断
- 潜在 Memory Candidate

## 4.3 Memory System

负责：

- Memory Formation
- Memory Decay
- Memory Retrieval
- Memory Reinforcement
- Memory Consolidation
- 历史压缩

## 4.4 Persistence

负责：

- Save
- Load
- Run History
- Replay
- Export

核心原则：

> **LLM 可以提出结果，但不能绕过规则引擎直接修改最终 Game State。**

---

# 5. Stage 0 — State Snapshot

每一个 Turn 开始之前，创建：

```text
State Before Turn
```

示例：

```json
{
  "run_id": 17,
  "day": 8,
  "turn_id": 124,
  "time": "16:40",
  "daily_progress": 6,
  "location": "library",
  "affection": 63,
  "trust": 51
}
```

Turn 完成后形成：

```text
State After Turn
```

因此：

```text
Before
  ↓
Turn Transaction
  ↓
After
```

可以计算：

```text
ΔState = StateAfter - StateBefore
```

用途：

- Debug
- Replay
- Save
- Rollback
- AI 异常恢复
- 状态审计

---

# 6. Stage 1 — World Tick

World Tick 更新世界当前状态。

例如：

```text
Day = 8
Time = 16:40
Weather = Rain
```

World Tick 判断：

- 时间
- 天气
- 地点状态
- 公共事件
- NPC 当前可能位置
- 随机事件概率
- 时间相关状态

输出：

```json
{
  "weather": "rain",
  "school_event": "club_recruitment",
  "heroine_location": "library"
}
```

重要原则：

> **World Tick 不负责写完整剧情，只负责确定“此刻世界是什么状态”。**

---

# 7. Stage 2 — Event Selection

Event Selection 决定：

> 当前 Turn 发生什么类型的事件。

不是简单随机，而是：

\[
EventScore =
BaseWeight
	imes
ContextModifier
	imes
CharacterModifier
	imes
RelationshipModifier
	imes
RandomFactor
\]

示例候选：

```text
ordinary_chat       40%
study_together      25%
accidental_meeting  15%
special_event       10%
conflict             5%
romantic_event       5%
```

当前状态可能进一步修正：

```text
rain = true
→ library_event × 1.5

trust > 50
→ intimacy_event × 1.2

stress > 80
→ conflict_event × 1.8
```

然后由 RNG 选出最终事件。

---

# 8. Event ≠ Story

事件只是：

> **这一 Turn 的叙事容器。**

例如：

```text
Event Type:
Library Encounter
```

它不是固定章节。

它只是向 AI 提供：

- 事件类型
- 世界条件
- 角色条件
- 行为约束
- 关系状态

AI 再根据当前状态生成具体故事。

因此仍然可以保持：

> **非固定剧情树、动态世界、AI 驱动叙事。**

---

# 9. Stage 3 — Context Assembly

接下来准备真正送给 LLM 的 Context。

输入：

```text
Game State
+
Character State
+
Relationship State
+
World State
+
Recent Events
+
Retrieved Memories
+
Player Model
+
Event Type
```

经过：

```text
Memory Retrieval
↓
Relevance Ranking
↓
Context Budget
↓
Prompt Composition
```

得到：

```text
LLM Context
```

Context Builder 不应该简单地把整个历史记录送给模型。

它必须根据：

- 当前情境
- 角色认知能力
- 记忆强度
- 相关性
- Context Budget

决定本轮应该让模型看到什么。

---

# 10. Stage 4 — Scenario Generation

这是第一次主要 LLM 调用。

目标：

> **生成当前 Turn 的具体场景。**

示例结构：

```json
{
  "scene": {
    "setting": "library",
    "situation": "heroine appears tired while studying",
    "character_emotion": "anxious",
    "emotional_intensity": 0.6,
    "latent_intent": "seek_company"
  }
}
```

同时生成玩家看到的自然语言：

> 图书馆里比平时安静得多。她盯着书页看了很久，却一直没有翻页。

---

# 11. Stage 5 — Option Planning

Scenario 确定以后，AI 先规划行为类型，而不是直接生成文本。

例如：

```text
Option A
support / low risk

Option B
tease / medium risk

Option C
leave / low risk

Option D
ask_emotion / high risk
```

每个 Option 至少包含：

```text
behavior
intent
tone
risk
progress
conditions
base_effects
```

---

# 12. Stage 6 — Option Realization

将结构化 Option 转换成自然语言。

例如：

```json
{
  "behavior": ["support"],
  "intent": ["care"],
  "tone": "gentle"
}
```

生成：

> “你是不是累了？要不要我陪你一会儿？”

这一阶段必须保持：

```text
Gameplay Logic
≠
Surface Language
```

也就是说：

> **内部规则和玩家看到的语言表现解耦。**

---

# 13. Stage 7 — Player Choice

玩家看到最终选项并进行选择：

```text
A
B
C
D
```

选择被记录：

```json
{
  "choice_id": "opt_003",
  "turn_id": 124,
  "selected_at": "..."
}
```

从这一刻开始：

> 玩家行为已经确定。

AI 不得重新解释成另一个行为类型。

---

# 14. Stage 8 — Choice Resolution

这是第一个核心 Deterministic Resolution 阶段。

输入：

```text
Selected Option
+
Character State
+
Relationship
+
World
+
Random Seed
```

计算：

```text
Daily Progress
Affection
Trust
Intimacy
Character Parameters
Mood
Stress
Flags
```

例如：

```text
Selected:
support

Base:
Affection +2
Trust +3

Modifiers:
Personality × 1.2
Current Mood × 0.8
Relationship × 1.1
```

得到：

```text
Affection +2
Trust +3
```

---

# 15. 为什么玩家选择后要先 Resolution，再生成 NPC Reaction

推荐顺序：

```text
Player Choice
↓
Game Engine 确认客观结果
↓
AI 根据结果生成角色反应
```

例如：

玩家：

> “陪她留下来。”

游戏引擎先确认：

```text
Daily Progress +2
Affection +3
Trust +2
```

然后把结果提供给 AI。

这样可以保证：

> **AI不会反过来决定规则。**

---

# 16. Stage 9 — NPC Reaction

第二次主要 LLM 调用。

输入：

```text
Player Choice
+
State Changes
+
Character State
+
Relevant Memories
+
Current Emotion
```

输出两个通道。

### Natural Language

> “谢谢……其实我今天不太想一个人。”

### Structured Reaction

```json
{
  "emotion": {
    "type": "relief",
    "intensity": 0.7
  },
  "intent": {
    "type": "seek_closeness",
    "intensity": 0.5
  },
  "memory_candidate": true
}
```

---

# 17. Stage 10 — Secondary State Resolution

一个 Turn 内允许存在两次 State Resolution。

## Resolution A

玩家行为产生的直接效果：

```text
Trust +2
Affection +3
```

## Resolution B

NPC 反应产生的二次反馈：

```text
Loneliness -5
Security +4
Intimacy +2
Stress -3
```

因此：

```text
Player Action
↓
Direct Effects
↓
NPC Reaction
↓
Secondary Effects
```

这会让角色反馈具有层次。

---

# 18. Stage 11 — Memory Formation

系统判断：

> 本轮事件是否值得形成长期记忆？

并不是所有对话都应该进入长期 Memory。

可以计算：

\[
MemoryCandidateScore =
Importance
	imes
EmotionalIntensity
	imes
Novelty
	imes
CharacterMemoryFactor
\]

如果：

```text
Score < Threshold
```

则：

> 不形成长期记忆，只保留在 Recent Events。

如果超过阈值，则创建：

- Episodic Memory
- Semantic Memory
- Emotional Memory

---

# 19. 三类 Memory

## Episodic Memory

记录具体事件：

> Day 8，玩家陪我在图书馆待到很晚。

## Semantic Memory

形成对玩家的长期认知：

> 玩家似乎很重视承诺。

## Emotional Memory

记录与情绪绑定的体验：

> 那天我真的觉得自己被理解了。

---

# 20. Stage 12 — Player Model Update

角色根据长期互动形成对玩家的认知。

例如：

```text
perceived_caring +2
perceived_attention +2
perceived_reliability +1
```

Player Model 是：

> **角色对玩家的主观理解**

而不是玩家真正的客观属性。

因此不同角色可能对同一行为产生完全不同的判断。

---

# 21. Stage 13 — World / Relationship Update

这一阶段将当前 Turn 的结果正式提交到 Game State。

例如：

```text
Daily Progress +2
Affection +3
Trust +2
Intimacy +2
Stress -4
```

同时：

```text
RecentEvents.append(...)
MemoryStore.update(...)
WorldState.update(...)
RelationshipState.update(...)
PlayerModel.update(...)
```

到此：

> **本 Turn 的主要状态变化完成。**

---

# 22. Stage 14 — Day Check

检查：

```text
Daily Progress >= Daily Limit ?
```

例如：

```text
8 / 10
```

结果：

> 当前 Day 继续。

如果：

```text
10 / 10
```

则：

```text
Day End
```

进入：

```text
Daily Summary
↓
Memory Consolidation
↓
Ending Check
↓
Night Phase
↓
Day + 1
```

---

# 23. Stage 15 — Ending Check

Ending 检查可以在每个 Turn 完成后执行，而不只是固定在某一天。

例如：

```text
Trust <= 0
+
Grudge >= 90
+
Conflict >= 80
```

可能立即触发：

> Bad End

而：

```text
Affection > 90
+
Trust > 80
+
Intimacy > 80
+
Day >= 20
```

可能满足：

> Good Ending

因此 Ending 是：

> **状态系统的自然结果，而不是传统章节树中的固定出口。**

---

# 24. Bad End Lifecycle

如果满足 Bad End 条件：

```text
Current Turn
↓
Ending Check
↓
Bad End
↓
Bad End Narrative
↓
Punishment Phase
↓
Meta Progression
↓
Run End
```

Punishment 可以包括：

- Debuff
- 新增 Memory
- 新增 Knowledge
- Ending Archive
- Unlock
- 下一 Run 的状态修改

失败不是简单的：

> Game Over

而是：

> **下一次 Run 的信息来源和成长来源。**

---

# 25. Stage 16 — Memory Consolidation

Day 结束后，对当天产生的短期信息进行整理。

例如：

```text
Event 1
Event 2
Event 3
Event 4
Event 5
```

经过 Consolidation：

```text
Long-term Memory:
1
2

Short-term:
3
4

Discarded:
5
```

这样可以：

- 防止历史无限增长
- 控制 Context
- 保留重要事件
- 形成角色长期认知

---

# 26. Stage 17 — Save Commit

推荐：

> **每个 Turn 自动形成一次可恢复状态。**

保存信息至少包括：

```text
Run ID
Day
Turn ID
State Before
State After
Player Choice
NPC Reaction
State Delta
New Memories
Player Model Update
World Update
RNG State
```

开发模式可以保留：

```text
run_017/
├── turn_001
├── turn_002
├── turn_003
└── ...
```

普通玩家模式则只显示当前存档。

---

# 27. Atomic Turn Transaction

整个 Turn 最好采用事务式模型：

```text
Read State
↓
Compute
↓
Generate
↓
Validate
↓
Commit
```

而不是：

```text
AI生成一句
→ 修改状态

AI再生成一句
→ 再修改状态
```

正确做法：

```text
State Before
↓
Turn Transaction
↓
Candidate State After
↓
Validation
↓
Commit
```

如果任何阶段失败：

```text
Rollback
↓
State Before
```

这样可以避免：

> AI 中途出错导致 Save 处于半更新状态。

---

# 28. AI 异常处理

## 28.1 非法 JSON

```text
Parser Error
↓
Retry
↓
Still Failed
↓
Fallback Template
```

## 28.2 非法数值

例如 AI 返回：

```json
{
  "affection_change": 5000
}
```

State Resolver：

```text
非法
↓
忽略 AI 数值
↓
使用游戏规则重新计算
```

## 28.3 不符合角色设定

```text
Generated Option
↓
Character Constraint Validation
↓
Failed
↓
Regenerate
```

核心原则：

> **LLM 是概率性、不完全可靠的模块；Game Engine 是确定性核心。**

---

# 29. Turn ID

建议每个 Turn 使用全局可定位 ID：

```text
run_017/day_008/turn_124
```

这样可以精确追踪：

- 发生了什么
- 玩家选了什么
- AI 当时看到了什么
- 参数如何变化
- 产生什么记忆
- 为什么触发 Bad End
- 使用了哪一个 RNG 状态

为后续 Debug、Replay、Export 提供基础。

---

# 30. 完整数据流

```text
INPUT
│
├── Game State
├── Character State
├── World State
├── Relationship State
├── Memory
└── RNG
│
▼
STATE SNAPSHOT
│
▼
WORLD TICK
│
▼
EVENT SELECTION
│
▼
CONTEXT ASSEMBLY
│
▼
SCENARIO GENERATION
│
▼
OPTION PLANNING
│
▼
OPTION REALIZATION
│
▼
PLAYER CHOICE
│
▼
DIRECT STATE RESOLUTION
│
▼
NPC REACTION
│
▼
SECONDARY STATE RESOLUTION
│
▼
MEMORY FORMATION
│
▼
PLAYER MODEL UPDATE
│
▼
WORLD / RELATIONSHIP UPDATE
│
▼
DAY / ENDING CHECK
│
├── Continue
│
├── Next Day
│
└── Ending
│
▼
MEMORY CONSOLIDATION
│
▼
SAVE COMMIT
│
▼
OUTPUT
│
└── Next Turn State
```

---

# 31. 完整案例

以下展示一个 Turn 的完整生命周期。

## 31.1 初始状态

```text
Day 8
16:40
Library

Daily Progress: 6 / 10

Affection: 63
Trust: 51
Intimacy: 44

Heroine:
Stress: 50
Energy: 40
Loneliness: 60

Weather: Rain
```

## 31.2 Event Selection

```text
Event:
Quiet Library Encounter
```

## 31.3 Scenario Generation

AI：

> 图书馆里几乎没有其他人。她盯着书页看了很久，却一直没有翻页。

结构化：

```json
{
  "emotion": "anxious",
  "intensity": 0.6,
  "intent": "seek_company"
}
```

## 31.4 Option Planning

```text
A: support / low risk
B: tease / medium risk
C: leave / low risk
D: ask_emotion / high risk
```

## 31.5 Option Realization

```text
A. 坐到她旁边，陪她待一会儿。

B. 开玩笑说：“你该不会是在等我吧？”

C. 觉得她可能想一个人，于是先离开。

D. 直接问她：“你是不是遇到什么事情了？”
```

## 31.6 Player Choice

玩家选择：

```text
D
```

## 31.7 Direct Resolution

```text
Behavior:
probe_emotion
care
risk = high

Trust +3
Affection +2
Intimacy +2
Daily Progress +2
```

## 31.8 NPC Reaction

AI：

> 她沉默了几秒，最后轻轻点了一下头。“嗯……其实今天有点糟糕。”

结构化：

```json
{
  "emotion": "vulnerable",
  "intensity": 0.75,
  "intent": "seek_reassurance",
  "memory_candidate": true
}
```

## 31.9 Secondary Resolution

```text
Loneliness -5
Security +4
Trust +2
Intimacy +3
Stress -3
```

## 31.10 Memory Formation

```text
Episodic:
“Day 8，玩家注意到了我的异常，并主动询问我发生了什么。”

Emotional:
“我觉得他真的注意到了我。”
```

## 31.11 Player Model

```text
perceived_caring +2
perceived_attention +2
```

## 31.12 World Update

```text
Daily Progress:
6 → 8
```

未达到上限。

所以：

> 当前 Day 继续。

## 31.13 Save Commit

生成：

```text
run_017/day_008/turn_124
```

保存：

```text
State Before
State After
Choice
Reaction
State Delta
Memories
Player Model
RNG
```

然后进入：

```text
run_017/day_008/turn_125
```

---

# 32. Turn 的工程定义

最终可以将 Turn 定义为：

> **Turn 是一个原子叙事事务（Atomic Narrative Transaction）：系统读取当前世界、角色、关系与记忆状态，选择并生成一个情境与若干行为选项，玩家进行选择，规则引擎解析直接状态变化，AI 根据结果生成角色反应，再由规则引擎处理二次反馈，随后形成或强化记忆、更新玩家模型与世界状态，进行 Day/Ending 检查，并将最终状态原子提交为新的游戏状态。**

这个定义可以作为未来代码架构的基础。

---

# 33. 下一阶段：从 Turn Lifecycle 进入软件架构

基于本生命周期，下一步需要设计具体的：

```text
WorldEngine.tick()
EventEngine.select()
ContextBuilder.build()
NarrativeEngine.generateScenario()
OptionEngine.plan()
OptionEngine.render()
StateResolver.resolveChoice()
NarrativeEngine.generateReaction()
StateResolver.resolveReaction()
MemoryEngine.form()
MemoryEngine.consolidate()
EndingEngine.check()
SaveManager.commit()
```

并为每个模块定义：

- 输入
- 输出
- 数据结构
- 权限
- 可修改状态
- LLM 调用点
- 错误处理
- 重试策略
- 回滚规则

到此，项目将从：

> **游戏设计阶段**

正式进入：

> **软件架构设计阶段。**
