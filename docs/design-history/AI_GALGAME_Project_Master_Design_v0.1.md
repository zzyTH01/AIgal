# AI GALGAME Framework
## 全项目总设计蓝图
### Project Master Design v0.1

---

# 0. 文档定位

本文档是目前 AI GALGAME Framework 项目的**总设计蓝图（Master Design）**。

它将此前已经完成的：

- 项目构思与设计理念
- Game State Design
- Option System
- Closed-Loop Narrative Feedback Framework
- Turn Lifecycle
- Software Architecture
- Data Contract Design
- 后续规划路线

统一整理为一份长期维护的项目设计基线。

本文档的目标不是立即进入编码，而是回答：

> **这个项目是什么、如何运行、核心数据是什么、AI负责什么、程序负责什么、如何进行角色设计、如何形成 Roguelike Run、如何与 SillyTavern 集成，以及未来如何逐步实现。**

---

# 1. 项目定义

## 1.1 项目定位

项目暂定名称：

> **AI GALGAME Framework**

核心定位：

> **一个以 SillyTavern 为可选 AI Runtime，以传统 GALGAME 的选择式交互为表现形式，以 Game State 为核心，以 AI 动态叙事与 Roguelike 机制驱动的 AI Narrative Game Framework。**

它同时是：

```text
AI GALGAME Runtime
+
AI GALGAME Designer
+
Character Creation System
+
Roguelike Narrative Engine
+
Memory / Cognition System
```

---

# 2. 核心设计宣言

项目最核心的设计理念：

> **作者创造世界和规则，AI 在规则允许的范围内不断生成可能性，玩家通过行为选项改变状态，而新的状态又反过来决定 AI 下一次能够生成什么。**

因此：

```text
World Rules
    ↓
AI
    ↓
Scenario
    ↓
Options
    ↓
Player Choice
    ↓
State Resolution
    ↓
Character / Relationship / World Changes
    ↓
Memory
    ↓
Context
    ↓
AI
    ↓
...
```

核心不是：

> AI 替作者写固定剧情。

而是：

> **AI 在一个由作者定义的世界和规则构成的沙盒中，持续生成动态叙事。**

---

# 3. 产品形态

项目最终不是一个单一插件，而是一个框架。

```text
                 AI GALGAME Framework
                         │
           ┌─────────────┼──────────────┐
           ▼             ▼              ▼
       Designer        Runtime        Player
           │             │              │
       创建游戏          运行游戏         玩游戏
           │             │              │
      Character       Game State       Save
      World           AI               UI
      Rules           Memory           Export
      Prompts         RNG
```

对应三个主要模式：

## 3.1 Design Mode

用于：

- 创建角色
- 编辑世界
- 编辑参数
- 定义事件
- 定义选项规则
- 定义 Ending
- 编辑 Prompt
- 测试 AI
- 模拟 Run

## 3.2 Play Mode

用于：

- 开始 Run
- 阅读 AI 剧情
- 选择行为
- 查看允许展示的状态
- 进行存档
- 查看 Ending
- 进行下一次 Run

## 3.3 Debug / Simulation Mode

用于：

- 单 Turn 调试
- 状态变化查看
- Memory 检查
- Context 检查
- RNG Replay
- 批量模拟
- AI 输出验证
- Balance Testing

---

# 4. 第一版产品边界

V1 的核心原则：

> **先实现纯文本可玩的完整游戏闭环。**

第一版必须具备：

- SillyTavern / LLM Runtime 接入
- Character Card / World Book 支持
- 选项式交互
- AI 动态生成场景
- AI 动态生成选项
- State Resolver
- 好感度 / 信任 / 亲密度等关系参数
- Character Psychology
- Daily Progress
- Day 系统
- 随机事件
- Memory
- Context Builder
- Good / Normal / Bad Ending
- Punishment / Meta Progression
- Run
- Save / Load
- Export
- Character Creator
- Design Mode
- Simulation Mode

第一版暂不作为核心：

- Live2D
- 高级 CG
- 复杂立绘动画
- 全语音
- 大规模地图
- 战斗系统
- 本地模型部署平台
- 大规模多人网络同步

表现层应该后置。

---

# 5. 核心游戏循环

一局游戏：

```text
New Run
 ↓
World Initialization
 ↓
Day 1
 ↓
Event
 ↓
Scenario
 ↓
Options
 ↓
Player Choice
 ↓
State Update
 ↓
NPC Reaction
 ↓
Memory
 ↓
Next Turn
 ↓
...
 ↓
Day End
 ↓
Next Day
 ↓
...
 ↓
Ending
 ↓
Punishment / Meta Progression
 ↓
New Run
```

---

# 6. Run / Day / Event / Turn 四级结构

整个时间结构：

```text
Run
└── Day
    └── Event / Scene
        └── Turn
            └── Player Choice
```

## Run

完整的一局游戏。

## Day

游戏世界中的一天。

## Event / Scene

当前发生的具体情境。

## Turn

玩家完成一次选择并完成一轮反馈循环的最小单位。

定义：

> **Turn 是一个原子叙事事务（Atomic Narrative Transaction）。**

---

# 7. Turn Lifecycle

V1 建议完整生命周期：

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

完整数据流：

```text
State Snapshot
↓
World Tick
↓
Event Selection
↓
Context Assembly
↓
Scenario Generation
↓
Option Planning
↓
Option Realization
↓
Player Choice
↓
Direct State Resolution
↓
NPC Reaction
↓
Secondary State Resolution
↓
Memory Formation
↓
Player Model Update
↓
World / Relationship Update
↓
Day / Ending Check
↓
Memory Consolidation
↓
Save Commit
↓
Next Turn
```

---

# 8. AI 与游戏规则的职责边界

这是项目最重要的架构原则之一。

## 8.1 AI 可以负责

- 当前场景是什么
- NPC 怎么说话
- NPC 如何自然反应
- 动态事件描述
- 候选行为选项
- 角色情绪的结构化判断
- NPC 意图
- Memory Candidate
- 玩家行为的潜在解释

## 8.2 游戏引擎必须负责

- Day
- Time
- Daily Progress
- Affection
- Trust
- Intimacy
- Character 参数
- Relationship
- Flags
- Ending
- RNG
- Save
- Memory 的最终写入
- 数值上下限
- 合法性验证
- Rollback

核心原则：

> **AI 可以提出结果，但 Game Engine 才能确认结果。**

---

# 9. Closed-Loop Narrative Feedback Framework

核心技术循环：

```text
World State
    ↓
Character State
    ↓
Relationship State
    ↓
AI Director
    ↓
Scenario
    ↓
Option Generator
    ↓
Player
    ↓
State Resolver
    ↓
Character / Relationship / World Update
    ↓
Memory Engine
    ↓
Context Builder
    ↓
LLM
    ↓
New Scenario
```

这一闭环是项目的真正核心。

---

# 10. Option System

Option 不应该只是：

```text
"陪她去图书馆"
```

而应该是：

> **Behavior Object / 行为对象**

结构：

```text
Option
├── Presentation
├── Behavior
├── Intent
├── Tone
├── Risk
├── Gameplay / Progress
├── Base Effects
├── Conditions
└── Generation Constraints
```

---

# 11. Option 的两层设计

## 11.1 Behavior / Intent

描述：

> 玩家做了什么。

示例：

```text
support
tease
comfort
challenge
avoid
flirt
apologize
lie
help
ignore
share
observe
```

## 11.2 Outcome Profile

定义基础影响：

```json
{
  "effects": {
    "affection": {
      "base": 2
    },
    "trust": {
      "base": 3
    }
  }
}
```

但这不是最终效果。

最终结果：

```text
Behavior
+
Personality
+
Character State
+
Relationship
+
World Context
+
Emotion
+
History
↓
State Resolver
↓
Final State Delta
```

---

# 12. Option Generation

Option 生成分为两阶段。

## Phase A: Option Planning

AI 先规划：

```text
A: support / low risk
B: flirt / medium risk
C: avoid / low risk
D: challenge / high risk
```

## Phase B: Option Realization

再把行为转换为玩家看到的语言：

> “你是不是累了？要不要我陪你一会儿？”

原则：

> **Gameplay Logic 与 Surface Language 分离。**

---

# 13. Option Diversity

避免：

```text
A. 陪她
B. 帮她
C. 和她一起
D. 陪她去
```

推荐每轮至少包含：

```text
1. 主动行为
2. 保守行为
3. 社交 / 关系行为
4. 风险行为
```

---

# 14. State Resolver

玩家选择之后：

```text
Selected Option
↓
Behavior
↓
Context Evaluation
↓
State Resolver
↓
Final State Delta
```

建议使用：

\[
\Delta X =
Base
\times
PersonalityModifier
\times
RelationshipModifier
\times
ContextModifier
\times
EmotionModifier
```

之后再增加：

- Repetition Modifier
- Risk Modifier
- History Modifier
- Memory Modifier

---

# 15. 非线性反馈

状态变化不应完全线性。

例如：

> 好感越高，继续提升同一数值的边际收益越低。

可以：

\[
\Delta A = Base \times f(Affection)
\]

避免：

> 重复选择一个选项就可以机械刷满好感。

---

# 16. 行为重复反馈

记录玩家行为：

```text
player_help = 7
player_flirt = 3
player_avoid = 2
```

同时记录：

```text
recentBehaviorPattern
```

例如：

```text
help
help
help
```

系统可以认为：

> 玩家最近过度保护角色。

从而降低进一步帮助的收益，甚至产生反效果。

---

# 17. Player Model

角色需要逐渐形成：

> **对玩家的主观认知。**

例如：

```text
perceived_caring
perceived_honesty
perceived_reliability
perceived_confidence
perceived_selfishness
perceived_romantic_interest
perceived_control
```

这不是客观玩家属性。

不同角色可以对同一玩家形成完全不同的判断。

---

# 18. Dynamic Character System

角色不是静态 Character Card。

角色由：

```text
Personality
+
Psychology
+
Emotion
+
Cognition
+
Physical
+
Activity
+
Relationship
+
Memory
```

共同构成。

因此角色会持续变化。

---

# 19. Character Cognition

角色认知参数包括：

```text
memoryCapacity
encoding
retention
retrieval
forgetfulness
grudge
obsession
attention
emotionalSalience
cognitiveLoad
```

这些参数共同决定：

- 哪些事能记住
- 记多久
- 什么时候想起来
- 哪些负面事件很难忘记
- 哪些事情会成为执念
- 一次能够处理多少历史信息

重要：

> `memoryCapacity` 是“角色虚拟认知能力”，不是 LLM 的真实 Context Window。

---

# 20. Memory System

Memory 生命周期：

```text
Raw Event
↓
Memory Candidate
↓
Encoding
↓
Short-Term Memory
↓
Consolidation
↓
Long-Term Memory
↓
Decay
↓
Retrieval
↓
Reinforcement
↓
Forget
```

---

# 21. Memory 类型

V1：

```text
Episodic
Semantic
Emotional
Social
```

例如：

### Episodic

> “Day 8，玩家陪我在图书馆待到很晚。”

### Semantic

> “玩家似乎很重视承诺。”

### Emotional

> “那天我真的觉得自己被理解了。”

---

# 22. Memory Decay

可以采用：

\[
S(t)=S_0e^{-\lambda t}
\]

其中：

- \(S_0\)：初始记忆强度
- \(t\)：经过时间
- \(\lambda\)：遗忘速度

遗忘速度受：

- Forgetfulness
- Retention
- Emotional Sensitivity
- Grudge
- Obsession

影响。

---

# 23. Memory Reinforcement

如果某个旧记忆被重新检索：

```text
Memory Strength
0.42
↓
0.68
```

即：

> **回忆本身会强化记忆。**

---

# 24. Memory Retrieval

未来可以综合：

```text
Semantic Similarity
+
Recency
+
Importance
+
Emotional Strength
+
Grudge
+
Obsession
+
Current Attention
```

形成：

```text
Memory Score
```

再选择 Top-K Memory 进入 Context。

---

# 25. Context Builder

Memory 与 Context 必须分离。

Memory：

> 角色记得什么。

Context：

> 本轮 AI 应该看到什么。

流程：

```text
GameState
+
Relevant Memory
+
Current Event
+
Character Cognition
↓
Context Builder
↓
ModelContext
↓
LLM
```

---

# 26. Cognitive Context Budget

例如：

```text
Character Cognitive Capacity = 80
```

可以分配：

```text
System Rules       15
Current State      15
Recent Events      20
Relevant Memories  20
Internal State     10
```

另一个健忘角色：

```text
Capacity = 40
```

只能访问更少历史信息。

因此：

> **角色的“记忆力”最终通过 Context Builder 体现。**

---

# 27. AI 双通道输出

AI 输出应该分为：

## Natural Language

给玩家：

> “谢谢……其实我今天不太想一个人。”

## Structured Output

给游戏引擎：

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
  "memoryCandidate": true
}
```

这样：

> **语言表现与游戏逻辑解耦。**

---

# 28. Game State 数据模型

核心 State：

```text
GameState
├── RunState
├── WorldState
├── CharacterStates
├── RelationshipStates
├── Flags
├── PlayerModel
├── MemoryState
├── MetaState
└── RNGState
```

---

# 29. RunState

```typescript
interface RunState {
  runId: RunId;
  startedAt: string;
  day: number;
  turn: number;
  time: string;
  dailyProgress: number;
  dailyProgressLimit: number;
  currentEventId?: EventId;
  currentLocationId: string;
  status: RunStatus;
}
```

---

# 30. CharacterState

```typescript
interface CharacterState {
  characterId: CharacterId;

  identity: CharacterIdentity;

  personality: PersonalityState;

  psychology: PsychologyState;

  emotion: EmotionState;

  cognition: CognitionState;

  physical: PhysicalState;

  activity: CharacterActivityState;

  status: CharacterStatus;
}
```

---

# 31. RelationshipState

```typescript
interface RelationshipState {
  relationshipId: RelationshipId;

  sourceId: CharacterId;
  targetId: CharacterId;

  type: RelationshipType;

  affection: number;
  trust: number;
  intimacy: number;
  familiarity: number;
  attraction: number;
  conflict: number;
  respect: number;
  dependency: number;

  customMetrics?: Record<string, number>;

  currentLabel?: string;

  tags: string[];

  status: RelationshipStatus;
}
```

---

# 32. WorldState

```typescript
interface WorldState {
  day: number;

  time: string;

  weekday: Weekday;

  season: Season;

  weather: WeatherState;

  currentLocationId: string;

  locations: Record<string, LocationState>;

  publicEvents: WorldEventState[];

  activeEvents: WorldEventState[];

  worldFlags?: Record<string, boolean | number | string>;
}
```

---

# 33. GameState 根接口

```typescript
interface GameState {
  schemaVersion: string;

  run: RunState;

  world: WorldState;

  characters: Record<CharacterId, CharacterState>;

  relationships: Record<
    RelationshipId,
    RelationshipState
  >;

  flags: Record<string, boolean | number | string>;

  playerModel: PlayerModel;

  memories: MemoryState;

  meta: MetaState;

  rng: RNGState;
}
```

项目正式实现时：

```text
schemas/game-state.schema.json
```

应作为 JSON Schema Single Source of Truth。

---

# 34. 软件架构

采用：

> **Core + Services + Adapters**

并参考：

> **Hexagonal Architecture / Ports & Adapters**

总体结构：

```text
                         Play / Design UI
                               │
                               ▼
                     Application Layer
                     Turn Orchestrator
                               │
       ┌───────────────────────┼────────────────────────┐
       ▼                       ▼                        ▼
   Game Core             Narrative Services        Memory Services
       │                       │                        │
       └───────────────────────┼────────────────────────┘
                               ▼
                         Infrastructure
                               │
          ┌────────────────────┼─────────────────────┐
          ▼                    ▼                     ▼
      LLM Gateway         Persistence          Runtime Adapters
          │                                      │
          ▼                              SillyTavern / Standalone
      Providers
```

---

# 35. 核心模块

V1 建议：

```text
1. Game Core
2. World Engine
3. Character & Relationship Engine
4. Narrative Engine
5. Option Engine
6. Memory Engine
7. Context Engine
8. Persistence Engine
9. Runtime Adapters
10. Design System
```

---

# 36. Game Core

Game Core 只负责游戏规则：

```text
GameState
Turn
Run
Day
StateResolver
RuleEngine
ProgressEngine
EndingEngine
```

不依赖：

- SillyTavern
- React
- OpenAI
- Claude
- Browser
- Database

---

# 37. Turn Orchestrator

负责执行 Turn Lifecycle：

```text
startTurn()
↓
worldTick()
↓
selectEvent()
↓
buildContext()
↓
generateScenario()
↓
planOptions()
↓
renderOptions()
↓
waitForChoice()
↓
resolveChoice()
↓
generateReaction()
↓
resolveReaction()
↓
formMemory()
↓
updateWorld()
↓
checkEnding()
↓
consolidateMemory()
↓
commitSave()
↓
completeTurn()
```

Orchestrator：

> 负责流程，不负责具体规则。

---

# 38. World Engine

负责：

```text
Time
Weather
Location
NPC Schedule
Public Events
Random Events
```

结构：

```text
WorldEngine
├── TimeService
├── CalendarService
├── WeatherService
├── LocationService
├── EventPool
└── WorldTick
```

---

# 39. Character & Relationship Engine

Character Engine：

```text
CharacterProfile
PersonalityModel
PsychologyModel
EmotionModel
CognitionModel
```

Relationship Engine：

```text
RelationshipState
RelationshipGraph
RelationshipRules
```

最终支持：

```text
Player ↔ Heroine A
Player ↔ Heroine B
Heroine A ↔ Heroine B
Heroine B ↔ Rival
```

为未来的多人关系和动态社交网络留出空间。

---

# 40. Narrative Engine

负责：

```text
Scenario Generation
NPC Reaction
Narrative Realization
```

不直接修改 GameState。

输出：

```text
GeneratedScenario
GeneratedReaction
```

---

# 41. Option Engine

负责：

```text
OptionPlanning
OptionValidation
OptionRendering
OptionScoring
OptionDiversity
```

支持：

- AI 自动生成
- 人工模板
- 条件限制
- 风险评分
- 多样性约束

---

# 42. Memory Engine

负责：

```text
MemoryStore
Formation
Decay
Retrieval
Reinforcement
Consolidation
```

不负责直接生成最终叙事。

---

# 43. Context Engine

负责：

```text
ContextBuilder
ContextBudget
MemoryRanker
StateSummarizer
PromptComposer
```

最终形成：

```text
ModelContext
```

---

# 44. LLM Gateway

Narrative Engine 不直接调用具体模型。

统一：

```typescript
interface LLMGateway {
  generate(
    request: LLMRequest
  ): Promise<LLMResponse>;
}
```

可以支持：

```text
OpenAI
Anthropic
Gemini
OpenAI-Compatible APIs
Local Models
```

---

# 45. SillyTavern Adapter

SillyTavern 定位：

> **AI Runtime / Character Runtime**

负责：

- Character Card
- World Book / Lorebook
- Prompt Runtime
- Context Bridge
- LLM Routing
- Extension Communication

而不负责：

- GameState
- StateResolver
- Ending
- RNG
- Save
- Memory Logic

因此：

> **SillyTavern 是 Adapter，而不是 Game Core。**

---

# 46. Character Compiler

角色系统最终应该支持：

```text
Character Definition
        ↓
Character Compiler
        ↓
┌──────────┬────────────┬────────────┐
↓          ↓            ↓
Game       SillyTavern  World Book
Character  Card         / Prompt
```

从而实现：

- Game Character
- Character Card
- World Book
- Prompt

之间的迁移。

---

# 47. Project Package

一款游戏应该被表示为一个 Project：

```text
GameProject
│
├── project.json
├── characters/
├── world/
├── parameters/
├── options/
├── events/
├── endings/
├── prompts/
├── assets/
├── saves/
└── meta/
```

定义：

> **Project = 一款完整的 AI GALGAME。**

---

# 48. Design Mode

设计器需要覆盖：

```text
Design Mode
├── Project
├── Character Creator
├── World Builder
├── Parameter Designer
├── Event Editor
├── Option Template Editor
├── Ending Editor
├── Prompt Editor
└── Simulation / Test Mode
```

---

# 49. Character Creator

角色创建应该不是简单填写 Character Card。

而应该：

```text
Character Definition
├── Identity
├── Personality
├── Preferences
├── Speech Style
├── Psychology Defaults
├── Cognition
├── Relationship Defaults
├── Secrets
├── Goals
├── Boundaries
└── Game Parameters
```

最终编译为：

```text
Game Character
+
SillyTavern Character Card
+
World Book
+
Prompt Configuration
```

---

# 50. Event System

随机世界必须建立在规则世界上。

事件类别：

```text
Daily
Social
Exploration
Conflict
Romantic
Special
World
Rare
```

事件选择：

\[
EventScore =
BaseWeight
\times
ContextModifier
\times
CharacterModifier
\times
RelationshipModifier
\times
RandomFactor
```

未来加入：

```text
Common
Uncommon
Rare
Legendary
```

产生 Roguelike 的事件稀有度。

---

# 51. Emergent Plot System

项目不依赖传统固定剧情树。

剧情通过：

```text
World State
+
Character Goals
+
Relationship State
+
Player Behavior
+
Event Pool
+
RNG
+
AI Generation
↓
Emergent Event
```

形成。

原则：

> **固定的是世界规则，不是每一步剧情。**

---

# 52. Good / Normal / Bad Ending

Ending 是状态的自然结果，而不是固定章节出口。

例如：

```text
Affection > 90
Trust > 80
Intimacy > 80
Day >= 20
↓
Good Ending
```

而：

```text
Trust <= 0
Grudge >= 90
Conflict >= 80
↓
Bad Ending
```

Ending Engine 每 Turn / Day 都可以进行检查。

---

# 53. Bad End 与 Punishment

Bad End：

```text
Bad End
↓
Bad End Narrative
↓
Punishment
↓
Meta Progression
↓
New Run
```

Punishment 可以包括：

- Debuff
- Knowledge
- Memory
- Unlock
- Ending Archive
- Permanent Modifier

核心理念：

> **失败不是 Game Over，而是下一次 Run 的信息与成长来源。**

---

# 54. Roguelike / Roguelite 机制

每个 Run：

```text
Run #001
↓
随机世界
↓
随机事件
↓
动态选项
↓
玩家选择
↓
Ending
```

然后：

```text
Run #002
```

部分信息跨 Run 保留：

```text
Knowledge
Meta Memories
Unlocks
Achievements
Ending Archive
Permanent Modifiers
```

但：

```text
World State
大部分 Character State
大部分 Relationship State
```

重新初始化。

---

# 55. Save / Load / Replay

由于系统同时具有：

- AI
- RNG
- 动态状态
- Memory

因此必须保存：

```text
Run ID
Day
Turn
State
Memory
Player Model
RNG State
Recent Events
Choice History
```

推荐每个 Turn 自动提交状态快照。

---

# 56. Atomic Turn Transaction

Turn 应采用：

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
AI输出
→ 立刻修改状态
→ 再输出
→ 再修改
```

正确：

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

发生错误：

```text
Rollback
↓
State Before
```

---

# 57. RNG 与 Replay

RNG 必须保存：

```text
seed
state
algorithm
```

Turn ID：

```text
run_017/day_008/turn_124
```

这样可以追踪：

- 当时发生什么
- 玩家选择什么
- AI 看到什么
- 使用哪些 Memory
- RNG 在什么状态
- State 如何变化

---

# 58. Debug System

建议未来支持：

```text
Turn Debugger
├── State Before
├── Context
├── Retrieved Memory
├── Event Selection
├── Options
├── Selected Option
├── Direct Delta
├── NPC Reaction
├── Secondary Delta
├── Memory Formation
├── Final State
└── State After
```

并显示 Modifier 来源：

```text
Affection +3

Base: +2
Personality: ×1.1
Trust: ×1.2
Emotion: ×0.9
Final: +3
```

---

# 59. Simulation Mode

设计器应该支持：

```text
Simulate 100 Runs
```

统计：

```text
Good Ending
Normal Ending
Bad Ending
Average Run Length
Average Day
Average Affection
Average Memory Count
Average Context Size
Event Frequency
Option Frequency
```

用途：

- Balance
- AI 稳定性测试
- RNG 检查
- Ending 分布
- Memory 增长测试
- Context Explosion 测试

这是后期非常关键的工具。

---

# 60. AI Reliability Layer

必须假设：

> **LLM 会犯错。**

因此至少需要：

```text
Schema Validation
+
Constraint Validation
+
State Validation
+
Narrative Consistency Check
+
Retry
+
Fallback
```

例如 AI 返回：

```json
{
  "affection_change": 5000
}
```

StateResolver：

```text
非法
↓
忽略 AI 数值
↓
重新使用游戏规则计算
```

如果 JSON 非法：

```text
Parse Error
↓
Retry
↓
Fallback
```

---

# 61. Content / Project Policy

成熟向内容不应写死进 Core。

应该采用 Project Policy：

```text
Project Policy
├── Age Rating
├── Relationship Types
├── Content Tags
├── Narrative Tone
├── Mature Themes
└── Generation Constraints
```

这样同一套 Engine 可以运行：

```text
全年龄恋爱
成熟向恋爱
LGBTQ+
悬疑
黑暗叙事
其他主题
```

而 Core 不需要为特定内容修改。

---

# 62. 多角色世界

最终项目不应该限制为：

```text
Player ↔ Heroine
```

而应支持：

```text
Player
├── Heroine A
├── Heroine B
├── Friend C
└── Rival D

Heroine A ↔ Heroine B
Heroine B ↔ Rival D
Friend C ↔ Player
```

关系系统最终可以形成：

> **Dynamic Relationship Graph**

这使项目从：

> 单女主攻略器

升级到：

> **World Simulation**

---

# 63. Software Architecture

推荐：

```text
Core
+
Application Services
+
Infrastructure
+
Adapters
```

最终结构：

```text
┌───────────────────────────────────────┐
│              EXPERIENCE              │
│                                      │
│       Player UI / Designer UI        │
└──────────────────┬────────────────────┘
                   │
┌──────────────────▼────────────────────┐
│              APPLICATION              │
│                                       │
│ Turn Orchestrator                     │
│ Game Services                         │
│ Narrative Services                    │
│ Memory Services                       │
│ Project / Save Services               │
└──────────────────┬────────────────────┘
                   │
┌──────────────────▼────────────────────┐
│                 CORE                  │
│                                       │
│ GameState                             │
│ Rules                                 │
│ StateResolver                         │
│ Relationship                          │
│ World Rules                           │
│ Ending                                │
│ Schemas                               │
└──────────────────┬────────────────────┘
                   │
┌──────────────────▼────────────────────┐
│              ADAPTERS                 │
│                                       │
│ SillyTavern                           │
│ LLM Providers                         │
│ File / SQLite                         │
│ Web / Desktop                         │
└───────────────────────────────────────┘
```

---

# 64. 数据所有权

这是架构的硬规则。

| 数据 | 权威模块 |
|---|---|
| Day / Time | Time Engine |
| Daily Progress | Progress Engine |
| Affection | State Resolver |
| Trust | State Resolver |
| Character Psychology | Character Engine + State Resolver |
| Relationship | Relationship Engine |
| World State | World Engine |
| Memory | Memory Engine |
| RNG | RNG Service |
| Ending | Ending Engine |
| Save | Persistence |
| Character Card | Character Compiler / Adapter |
| LLM Context | Context Builder |
| AI Narration | Narrative Engine |

原则：

> **一个核心状态只能有一个权威写入路径。**

---

# 65. Persistence

V1：

```text
JSON + Directory
```

例如：

```text
saves/
└── run_017/
    ├── manifest.json
    ├── state.json
    ├── memories.json
    ├── history/
    │   ├── turn_001.json
    │   ├── turn_002.json
    │   └── ...
    └── meta.json
```

未来：

```text
SQLite
```

---

# 66. Schema System

建议使用：

```text
JSON Schema Draft 2020-12
+
TypeScript
+
Zod / Runtime Validation
```

Schema 目录：

```text
schemas/
├── game-state.schema.json
├── character.schema.json
├── relationship.schema.json
├── option.schema.json
├── event.schema.json
├── state-delta.schema.json
├── turn-result.schema.json
├── context.schema.json
├── memory.schema.json
├── save.schema.json
└── project.schema.json
```

原则：

> **Schema 是 Single Source of Truth。**

---

# 67. 推荐技术栈

V1 候选基线：

## Core

```text
TypeScript
```

原因：

- 类型系统适合复杂 Schema
- Web / Desktop 共用
- JSON 友好
- SillyTavern Extension 适配方便
- Agent Coding 生态成熟

## UI

```text
React
```

## Validation

```text
Zod
+
JSON Schema
```

## Persistence

```text
JSON
→
SQLite
```

## LLM

```text
LLM Gateway
```

支持：

```text
OpenAI-compatible
Anthropic
Gemini
Local Models
```

---

# 68. RAG 的定位

RAG 不是整个游戏的核心。

主要用于：

```text
Memory Retrieval
```

推荐：

```text
Memory Store
↓
Candidate Retrieval
↓
Metadata Filter
↓
Semantic Retrieval
↓
Scoring
↓
Context Builder
```

结构化状态：

```text
Affection
Trust
Day
Time
Flags
Progress
```

不需要通过 RAG 获取。

---

# 69. Hybrid Memory Retrieval

未来：

```text
Memory Retrieval
├── Exact / Rule Filter
├── Metadata Filter
├── Recency
├── Importance
├── Semantic Similarity
├── Emotional Salience
├── Grudge
└── Obsession
```

最终：

\[
Score =
w_rR+
w_iI+
w_sS+
w_eE+
w_oO
\]

---

# 70. Project Directory

推荐最终：

```text
ai-galgame/
│
├── apps/
│   ├── player/
│   ├── designer/
│   └── devtools/
│
├── packages/
│   ├── core/
│   │   ├── state/
│   │   ├── rules/
│   │   ├── turn/
│   │   ├── ending/
│   │   └── events/
│   │
│   ├── character/
│   ├── relationship/
│   ├── world/
│   ├── narrative/
│   ├── option/
│   ├── memory/
│   ├── context/
│   ├── schemas/
│   ├── persistence/
│   └── adapters/
│       ├── sillytavern/
│       ├── llm/
│       └── runtime/
│
├── projects/
├── saves/
├── docs/
└── tests/
```

---

# 71. Monorepo Strategy

V1 推荐：

> **Monorepo + Modular Architecture**

而不是微服务。

即：

```text
一个项目
一个主要 Runtime
多个独立逻辑模块
```

暂时不拆：

```text
World Server
Memory Server
LLM Server
Save Server
```

原因：

- 开发更简单
- Debug 更简单
- 本地运行方便
- Coding Agent 更容易理解
- 没有不必要的网络复杂度

---

# 72. Application API

前端不直接访问内部 Service。

建议提供 Application API：

```text
POST /game/start
POST /turn/start
POST /turn/choice
GET  /game/state
POST /save
POST /load
POST /export
```

例如：

```text
POST /turn/choice
```

```json
{
  "turnId": "turn_124",
  "optionId": "option_003"
}
```

返回：

```json
{
  "narrative": "...",
  "stateDelta": {},
  "nextTurn": {}
}
```

---

# 73. Domain Event Bus

未来可以加入：

```text
PlayerChoiceSelected
↓
ChoiceResolved
↓
NPCReactionGenerated
↓
StateChanged
↓
MemoryCreated
↓
RelationshipChanged
↓
DayEnded
↓
RunEnded
```

模块只订阅自己关心的事件。

---

# 74. Domain Event 与 State 分离

State：

```text
Affection = 63
```

Event：

```json
{
  "type": "AffectionChanged",
  "before": 60,
  "after": 63,
  "source": "choice_003"
}
```

作用：

- Debug
- Replay
- Audit
- Analytics
- 原因追踪
- State History

---

# 75. V1 数据契约优先级

目前已经基本完成：

```text
GameState
CharacterState
RelationshipState
WorldState
MemoryState
PlayerModel
MetaState
RNGState
```

下一批最重要：

```text
1. Option
2. Event
3. StateDelta
4. TurnResult
5. Context
6. SaveSnapshot
```

优先顺序：

```text
Option
↓
StateDelta
↓
Event
↓
TurnResult
↓
Context
↓
SaveSnapshot
```

---

# 76. StateDelta

StateDelta 是连接：

```text
Option
→
StateResolver
→
GameState
```

的关键数据结构。

它应该能够表达：

```text
Run Changes
Character Changes
Relationship Changes
World Changes
Flags
Memory Candidates
Meta Changes
```

例如：

```json
{
  "run": {
    "dailyProgress": 2
  },
  "relationship": {
    "affection": 3,
    "trust": 2
  },
  "character": {
    "stress": -4,
    "security": 5
  },
  "flags": {
    "heroine_opened_up": true
  }
}
```

但最终还需要区分：

```text
BaseDelta
Modifier
FinalDelta
```

---

# 77. State Resolver 设计目标

下一阶段要正式定义：

```text
Base Effect
↓
Personality Modifier
↓
Relationship Modifier
↓
Emotion Modifier
↓
Context Modifier
↓
History / Repetition Modifier
↓
Risk Modifier
↓
Clamp
↓
Final State Delta
```

并处理：

- 非线性反馈
- 变量联动
- 相互制约
- 状态上限
- 状态下限
- 冲突
- 非法值
- 二次反馈

---

# 78. Event System 下一阶段

正式定义：

```text
EventDefinition
EventCandidate
EventInstance
EventResult
```

以及：

```text
EventPool
EventWeight
EventRarity
EventCondition
EventCooldown
EventFrequency
```

最终：

```text
Event Selection
=
Rules
+
Context
+
State
+
RNG
```

---

# 79. AI Prompt Architecture

Prompt 必须按任务分层。

推荐：

```text
Prompt
├── System Rules
├── World Rules
├── Character Definition
├── Character State
├── Relationship
├── Cognition
├── Relevant Memories
├── Current Event
├── Current Task
└── Output Schema
```

不同任务使用不同 Prompt：

```text
Scenario Prompt
Option Planning Prompt
Option Realization Prompt
Reaction Prompt
Emotion Analysis Prompt
Memory Extraction Prompt
Player Model Update Prompt
```

原则：

> **一个 Prompt 不承担所有任务。**

---

# 80. Content Policy Layer

项目可以允许不同作品拥有不同内容规则。

例如：

```text
ProjectPolicy
├── AgeRating
├── RelationshipRules
├── ContentTags
├── MatureThemes
├── NarrativeTone
└── GenerationConstraints
```

角色数据层限制：

```text
Character age >= 18
```

这样框架 Core 本身保持通用。

---

# 81. 多 Run Meta Progression

跨 Run 可以保存：

```text
Knowledge
Meta Memories
Unlocks
Achievements
Ending Archive
Permanent Modifiers
```

从而形成：

```text
失败
↓
获得信息
↓
新 Run
↓
使用信息
↓
发现新路线
```

这才是完整的：

> **Roguelite Narrative Progression**

---

# 82. Emergent Story

最终故事应该由：

```text
World
+
Character Goals
+
Relationship
+
Memory
+
Player Actions
+
RNG
+
AI
```

共同产生。

因此：

> **剧情是状态演化的结果。**

而不是作者写好的树。

---

# 83. 角色关系的动态模拟

角色可以：

- 喜欢玩家
- 信任玩家
- 怀疑玩家
- 讨厌玩家
- 依赖玩家
- 嫉妒玩家
- 逐渐疏远
- 与其他角色形成关系

并且：

```text
Relationship A
```

变化时，可以影响：

```text
Relationship B
```

例如：

```text
Heroine A ↔ Player
        ↓
Heroine B 的 Jealousy
        ↓
Heroine B ↔ Player
```

未来可以实现：

> **Relationship Graph Feedback**

---

# 84. Design Simulation

设计者可以选择：

```text
Run count = 100
```

进行自动模拟。

观察：

```text
Ending Distribution
Event Distribution
Average Affection
Bad End Rate
Memory Growth
Context Growth
Turn Length
```

用于：

> **自动平衡游戏设计。**

---

# 85. 测试策略

未来测试分为：

## Unit Test

测试：

- StateResolver
- Modifier
- MemoryDecay
- EventWeight
- EndingCondition

## Integration Test

测试：

- Turn Lifecycle
- Memory + Context
- LLM Gateway
- Save / Load

## Simulation Test

测试：

- 100 Runs
- 1000 Runs
- RNG
- Ending Distribution
- Context Explosion

## Golden Test

固定：

```text
RNG Seed
GameState
LLM Fixture
```

检查：

> 输出是否仍然符合预期。

---

# 86. 性能与成本策略

AI 游戏最大的现实问题之一是：

> **LLM 调用次数和 Token 成本。**

因此 V1 就应该设计：

```text
LLM Call Minimization
```

例如一个 Turn 最理想：

```text
1. Scenario Generation
2. Option Generation
3. NPC Reaction
```

而：

```text
StateResolver
Memory
Ending
```

尽量纯程序执行。

以后可以将：

```text
Scenario + Options
```

合并成一次模型调用。

---

# 87. Context Cache

一些内容不需要每轮重新生成：

```text
Character Definition
World Rules
Stable Personality
```

可以缓存。

每轮只更新：

```text
Dynamic State
Recent Events
Relevant Memory
Current Event
```

减少 Token。

---

# 88. State Snapshot / Diff

Save 不一定每次都保存完整 GameState。

未来可以：

```text
Full Snapshot
+
State Delta
```

例如：

```text
Day 8 Snapshot
↓
Turn 124 Delta
↓
Turn 125 Delta
↓
Turn 126 Delta
```

同时定期生成新的 Full Snapshot。

这样兼顾：

- 存储效率
- Replay
- Rollback
- Debug

---

# 89. 第一阶段完整开发路线

推荐：

```text
Phase 0
设计冻结
↓
Phase 1
Data Contract
↓
Phase 2
Pure Game Core
↓
Phase 3
State Resolver
↓
Phase 4
Event + RNG
↓
Phase 5
Narrative / Option Engine
↓
Phase 6
Memory / Context
↓
Phase 7
LLM Gateway
↓
Phase 8
SillyTavern Adapter
↓
Phase 9
Minimal Play UI
↓
Phase 10
Designer Mode
↓
Phase 11
Simulation / Debug
↓
Phase 12
Visual / Audio
```

---

# 90. Phase 0 — Design Freeze

完成：

- Project Definition
- Game State
- Turn Lifecycle
- Architecture
- Option Philosophy
- Memory Philosophy

当前已经基本完成。

---

# 91. Phase 1 — Data Contract

正式冻结：

```text
GameState
CharacterState
RelationshipState
WorldState
Option
Event
StateDelta
TurnResult
Context
SaveSnapshot
Project
```

输出：

```text
TypeScript Interfaces
+
JSON Schemas
+
Validation
```

---

# 92. Phase 2 — Pure Game Core

完全不接 LLM。

模拟：

```text
GameState
↓
Option
↓
StateDelta
↓
StateResolver
↓
New GameState
```

如果这一步不能稳定运行：

> 不接 AI。

---

# 93. Phase 3 — State Resolver

建立：

```text
Modifier Engine
Formula Engine
Clamp
Dependency Graph
Nonlinear Response
```

测试：

```text
相同 Option
+
不同 Character
=
不同结果
```

这是整个系统的核心玩法测试。

---

# 94. Phase 4 — Event + RNG

实现：

```text
EventPool
EventWeight
Condition
Cooldown
Rarity
RNG
```

完成：

> “无固定剧情但规则可控”的世界。

---

# 95. Phase 5 — Narrative / Option Engine

加入 LLM：

```text
Scenario Generation
Option Planning
Option Realization
NPC Reaction
```

但仍然：

> StateResolver 掌握最终状态权。

---

# 96. Phase 6 — Memory / Context

实现：

```text
Memory Formation
Memory Decay
Memory Retrieval
Memory Reinforcement
Memory Consolidation
Context Budget
```

这是实现：

> “角色真的记得你。”

的核心阶段。

---

# 97. Phase 7 — LLM Gateway

支持：

```text
OpenAI
Anthropic
Gemini
OpenAI-Compatible
Local Models
```

提供统一：

```typescript
LLMGateway.generate()
```

---

# 98. Phase 8 — SillyTavern Adapter

最终接：

```text
Character Card
World Book
Prompt
Context
LLM
```

将：

```text
Game Character
```

编译到：

```text
SillyTavern Character Card
```

---

# 99. Phase 9 — Minimal Play UI

第一版 UI：

```text
Background Placeholder
+
Character Name
+
Narrative
+
3~4 Options
+
Daily Progress
+
Minimal Status
```

输入框取消。

玩家只做：

> **选择。**

---

# 100. Phase 10 — Designer Mode

实现：

```text
Character Creator
World Builder
Parameter Designer
Event Editor
Option Templates
Ending Editor
Prompt Editor
Project Export
```

---

# 101. Phase 11 — Simulation / Debug

实现：

```text
Run Simulation
Turn Debugger
Memory Inspector
Context Inspector
State Inspector
RNG Replay
```

让整个项目真正变成：

> **可以设计和调试的 AI GALGAME Framework。**

---

# 102. Phase 12 — Presentation Layer

最后才加入：

```text
Character Sprite
Background
CG
Animation
Live2D
TTS
BGM
SE
```

原则：

> **表现层不应该改变 Core 游戏逻辑。**

---

# 103. 最终产品架构

最终可以理解为：

```text
                         AI GALGAME
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
   DESIGNER                RUNTIME                 PLAYER
       │                      │                      │
 Character Creator        Game State              UI
 World Builder             Turn Engine            Options
 Event Editor              Memory                  Save
 Prompt Editor             Context                 Ending
 Simulation                LLM
       │                      │
       └──────────────┬───────┘
                      ▼
               Runtime Adapter
                      │
              ┌───────┴───────┐
              ▼               ▼
         SillyTavern       Standalone
```

---

# 104. 项目最核心的三个地基

如果把整个项目压缩为三个核心：

```text
             AI GALGAME CORE
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    State Model  Resolver    AI Context
        │           │           │
        └───────────┼───────────┘
                    ▼
              Dynamic Loop
```

## State Model

> 游戏知道什么。

## State Resolver

> 玩家的行为造成什么。

## AI Context

> AI 此刻知道什么。

这三个系统构成：

> **AI GALGAME 的核心计算闭环。**

---

# 105. 项目最终愿景

最终目标并不是：

> “做一个会聊天的 GALGAME。”

也不是：

> “给 SillyTavern 做一个好看的 UI。”

真正目标是：

> **创造一个可以让作者定义人物、世界和规则，再由 AI 在规则约束下持续生成独特人生体验的叙事游戏框架。**

传统 GAL：

```text
作者
↓
剧情
↓
玩家
```

本项目：

```text
作者
↓
世界规则
↓
AI
↓
动态世界
↓
玩家
↓
AI
↓
动态世界
↓
...
```

因此玩家经历的每一次 Run 都可以不同。

---

# 106. 最终核心设计哲学

项目可以用以下六句话概括：

> **固定规则，而不是固定剧情。**

> **玩家选择的是行为，而不是台词。**

> **AI负责表现，规则引擎负责真实状态。**

> **角色记住什么，决定角色如何理解现在。**

> **失败不是终点，而是下一次 Run 的信息。**

> **SillyTavern 是 Runtime，不是游戏本体。**

---

# 107. 当前设计状态

## 已完成 / 基本冻结

- 项目定位
- 核心玩法
- Roguelike Run
- Daily Progress
- Option-based interaction
- Dynamic State Feedback
- Character Cognition
- Memory System 概念
- Context Budget 概念
- Turn Lifecycle
- 软件总体架构
- GameState
- CharacterState
- RelationshipState
- WorldState
- 基础 TypeScript Interface
- 基础 JSON Schema

## 下一批需要正式冻结

```text
Option Schema
Event Schema
StateDelta Schema
TurnResult Schema
Context Schema
SaveSnapshot Schema
Project Schema
CharacterDefinition Schema
```

---

# 108. 下一阶段建议顺序

接下来严格按照：

```text
1. Option Schema
        ↓
2. StateDelta Schema
        ↓
3. Event Schema
        ↓
4. TurnResult Schema
        ↓
5. StateResolver Specification
        ↓
6. Event / RNG Specification
        ↓
7. Prompt Architecture
        ↓
8. Memory Architecture
        ↓
9. Context Builder
        ↓
10. Character Definition
        ↓
11. Project Schema
        ↓
12. Service Interfaces
        ↓
13. Prototype
```

---

# 109. Prototype 的最终验收标准

在进入 UI / CG / Live2D 之前，纯文本 Prototype 必须做到：

```text
创建角色
↓
创建世界
↓
生成 Run
↓
随机事件
↓
AI生成场景
↓
生成4个选项
↓
玩家选择
↓
StateResolver
↓
NPC反应
↓
Memory
↓
Context更新
↓
下一Turn
↓
Next Day
↓
Bad / Normal / Good Ending
↓
Punishment
↓
Meta Progression
↓
New Run
```

并且：

> **至少连续运行几十个 Turn 而不破坏 Game State。**

---

# 110. 第一版成功标准

如果纯文本 Prototype 已经能做到：

> “我感觉这个角色真的记得我做过什么，而且她现在的反应和几天前发生的事情有关；同样一个选择换一个角色可能完全不同；这一局失败以后，下一局因为我知道了某些东西而发生了变化。”

那么：

> **这个项目的核心已经成立。**

之后的：

- 立绘
- CG
- Live2D
- TTS
- BGM
- 华丽 UI

都只是表现层扩展。

---

# 111. 最终开发顺序总览

```text
                    PROJECT MASTER PLAN

                         DESIGN
                            │
                            ▼
                    Data Contract
                            │
                            ▼
                     Game Core
                            │
                            ▼
                   State Resolver
                            │
                            ▼
                    Event + RNG
                            │
                            ▼
                  Narrative Engine
                            │
                            ▼
                   Memory Engine
                            │
                            ▼
                   Context Builder
                            │
                            ▼
                     LLM Gateway
                            │
                            ▼
                  SillyTavern Adapter
                            │
                            ▼
                     Minimal UI
                            │
                            ▼
                    Design Mode
                            │
                            ▼
                  Simulation / Debug
                            │
                            ▼
                  Presentation Layer
                            │
                            ▼
                    Full AI GALGAME
```

---

# 112. Master Design Conclusion

目前项目已经从最初的：

> “基于酒馆做一个 GALGAME”

发展成：

> **一个以状态驱动叙事、认知型角色、AI动态选项、Roguelike Run 和反馈闭环为核心的 AI GALGAME 开发与运行框架。**

其核心运行模式可以最终概括为：

```text
世界
↓
角色
↓
记忆
↓
AI Context
↓
AI
↓
事件
↓
选项
↓
玩家
↓
State Resolver
↓
角色 / 关系 / 世界变化
↓
Memory
↓
Context
↓
AI
↓
...
```

而项目的软件架构保证：

```text
Game Core
≠
SillyTavern
≠
LLM Provider
≠
UI
```

从而能够长期演进为：

> **一个真正可设计、可运行、可调试、可迁移、可扩展的 AI Narrative Game Framework。**
