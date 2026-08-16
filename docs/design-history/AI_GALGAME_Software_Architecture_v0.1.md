# AI GALGAME Framework
## Software Architecture Design
### Architecture Design v0.1

---

# 1. Architecture Goal

本阶段进入项目的软件架构设计。

核心目标：

> 将“游戏逻辑”和“SillyTavern”解耦，使 SillyTavern 成为可替换的 AI Runtime / Adapter，而不是游戏本体。

整个系统应能够独立运行：

- Game State
- Game Rules
- Turn Lifecycle
- Memory
- World
- Relationship
- Option
- Ending
- Save
- Character Creator
- Design Mode

SillyTavern 主要负责：

- Character Card
- World Book / Lorebook
- Prompt Runtime
- LLM Connection
- 相关扩展能力

因此：

> **Game Core 不应该知道 SillyTavern 是否存在。**

---

# 2. 总体架构

采用：

> **Core + Services + Adapters**

并参考：

> **Hexagonal Architecture / Ports & Adapters**

总体结构：

```text
                         ┌──────────────────────┐
                         │      Play UI         │
                         │  GALGAME Interface   │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │    Application       │
                         │       Layer          │
                         │    Turn Orchestrator │
                         └──────────┬───────────┘
                                    │
        ┌───────────────────────────┼──────────────────────────┐
        │                           │                          │
        ▼                           ▼                          ▼
┌───────────────┐           ┌───────────────┐          ┌───────────────┐
│   Game Core   │           │  AI Services  │          │   Memory      │
│               │           │               │          │   Services    │
│ State         │           │ Narrative     │          │ Retrieval     │
│ Rules         │           │ Option        │          │ Formation     │
│ Resolver      │           │ Reaction      │          │ Consolidation │
│ Ending        │           │               │          │               │
└───────┬───────┘           └───────┬───────┘          └───────┬───────┘
        │                           │                          │
        └───────────────────────────┼──────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Infrastructure │
                           │                 │
                           │ Persistence     │
                           │ LLM Gateway     │
                           │ RNG             │
                           │ Import/Export   │
                           └────────┬────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
           SillyTavern         File/DB             External LLM
             Adapter             Store               Provider
```

核心特点：

> **Game Core 与外部 Runtime 解耦。**

---

# 3. Data Ownership

软件架构中最重要的问题之一：

> **谁有权修改某个数据？**

V1 必须建立明确的数据所有权。

| 数据 | 唯一权威模块 |
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
| Character Card | Character Adapter |
| LLM Context | Context Builder |
| AI 生成文本 | Narrative Engine |

核心规则：

> **任何核心状态只能存在一个权威写入路径。**

LLM 不可以直接写：

```text
affection = 80
```

而应该提出：

```text
potential_effect:
affection + 3
```

然后由：

```text
StateResolver
```

决定最终状态。

---

# 4. 核心模块

V1 建议划分为 8 个核心模块：

```text
1. Game Core
2. World Engine
3. Character & Relationship Engine
4. Narrative Engine
5. Memory Engine
6. Context Engine
7. Persistence Engine
8. Runtime Adapters
```

总体：

```text
GameCore
    ├── State
    ├── Rules
    ├── Turn
    └── Ending

WorldEngine
    ├── Time
    ├── Location
    ├── Weather
    └── Events

CharacterEngine
    ├── Character
    ├── Personality
    ├── Psychology
    └── Cognition

NarrativeEngine
    ├── Scenario
    ├── Option
    └── Reaction

MemoryEngine
    ├── Formation
    ├── Retrieval
    ├── Decay
    └── Consolidation

ContextEngine
    ├── Context Budget
    ├── Ranking
    └── Prompt Assembly

Persistence
    ├── Save
    ├── Load
    └── Export

RuntimeAdapters
    ├── SillyTavern
    ├── LLM
    └── UI
```

---

# 5. Game Core

Game Core 是整个系统的规则核心。

它不应该依赖：

- SillyTavern
- React
- OpenAI
- Claude
- 浏览器
- 数据库

它只负责：

> **游戏规则和游戏状态。**

目录：

```text
GameCore
├── GameState
├── Turn
├── Run
├── Day
├── StateResolver
├── RuleEngine
├── ProgressEngine
└── EndingEngine
```

---

# 6. GameState

`GameState` 是游戏运行时的核心状态集合。

建议：

```typescript
interface GameState {
  run: RunState;
  world: WorldState;
  characters: Record<CharacterId, CharacterState>;
  relationships: Record<RelationshipId, RelationshipState>;
  memories: MemoryState;
  playerModel: PlayerModel;
  flags: FlagState;
  meta: MetaState;
  rng: RNGState;
}
```

需要注意：

> **GameState 是数据，不是业务逻辑。**

业务规则应该由 Engine / Service 实现。

---

# 7. Application Layer — Turn Orchestrator

这是整个软件最重要的协调模块之一。

职责：

> **把 Turn Lifecycle 串联起来。**

示意：

```text
TurnOrchestrator

.startTurn()
    ↓
.worldTick()
    ↓
.selectEvent()
    ↓
.buildContext()
    ↓
.generateScenario()
    ↓
.planOptions()
    ↓
.renderOptions()
    ↓
.waitForPlayerChoice()
    ↓
.resolveChoice()
    ↓
.generateReaction()
    ↓
.resolveReaction()
    ↓
.formMemory()
    ↓
.updateWorld()
    ↓
.checkEnding()
    ↓
.consolidateMemory()
    ↓
.commitSave()
    ↓
.completeTurn()
```

Orchestrator：

- 不负责计算好感度
- 不负责实现 Memory 算法
- 不负责直接调用数据库
- 不负责生成最终文本

它只负责：

> **按照生命周期调用正确的模块。**

---

# 8. UI 与 Application Layer

UI 不应该直接修改 GameState。

错误：

```text
UI
 ↓
LLM
 ↓
修改 GameState
 ↓
Save
```

正确：

```text
UI
 ↓
Application API
 ↓
Turn Orchestrator
 ↓
Game Services
 ↓
Game State
```

因此：

> **UI 只是系统的使用者，不是规则的持有者。**

---

# 9. World Engine

World Engine 管理世界：

```text
Time
Weather
Location
NPC Schedule
Public Events
Random Events
```

建议：

```text
WorldEngine
├── TimeService
├── CalendarService
├── WeatherService
├── LocationService
├── EventPool
└── WorldTick
```

接口示意：

```typescript
interface WorldEngine {
  tick(state: GameState): WorldUpdate;
  generateCandidates(state: GameState): EventCandidate[];
  applyUpdate(state: GameState, update: WorldUpdate): GameState;
}
```

World Engine 可以提出：

> 某事件权重提高。

但最终事件选择由 Event Selection / Event Engine 负责。

---

# 10. Character Engine

负责：

```text
Character Definition
Personality
Psychology
Emotion
Cognition
```

结构：

```text
CharacterEngine
├── CharacterProfile
├── PersonalityModel
├── PsychologyModel
├── EmotionModel
└── CognitionModel
```

建议：

```typescript
interface CharacterState {
  personality: PersonalityState;
  psychology: PsychologyState;
  emotion: EmotionState;
  cognition: CognitionState;
}
```

Character Engine 的重点：

> 描述“这个角色是谁，以及她当前是什么状态”。

---

# 11. Relationship Engine

角色本身和关系应该分离。

Character：

> “这个人是谁。”

Relationship：

> “两个人之间是什么关系。”

因此单独建立：

```text
RelationshipEngine
```

例如：

```typescript
interface RelationshipState {
  characterA: CharacterId;
  characterB: CharacterId;

  affection: number;
  trust: number;
  intimacy: number;
  familiarity: number;

  relationshipType: RelationshipType;
}
```

未来可以形成 Relationship Graph：

```text
Player ↔ Heroine
Heroine ↔ Friend
Heroine ↔ Rival
Friend ↔ Player
```

从而支持复杂的多人关系网络。

---

# 12. Narrative Engine

Narrative Engine 是 Game Core 与 LLM Runtime 之间的桥。

负责：

```text
Scenario Generation
Option Planning
Option Realization
NPC Reaction
```

结构：

```text
NarrativeEngine
├── ScenarioGenerator
├── OptionPlanner
├── OptionRenderer
└── ReactionGenerator
```

重要原则：

> **Narrative Engine 不直接修改 GameState。**

它只产生：

```text
GeneratedScenario
GeneratedOptions
GeneratedReaction
```

然后交给规则引擎处理。

---

# 13. Option Engine

由于 Option 是玩家和 AI GALGAME 交互的核心接口，建议进一步独立。

```text
OptionEngine
├── OptionPlanner
├── OptionValidator
├── OptionRenderer
└── OptionScorer
```

这样可以同时支持：

- AI 自动生成选项
- 人工设计选项模板
- 选项合法性校验
- 风险评分
- 选项排序
- 选项多样性约束

---

# 14. Memory Engine

Memory Engine 是整个系统的核心高级模块之一。

建议：

```text
MemoryEngine
├── MemoryStore
├── MemoryFormation
├── MemoryDecay
├── MemoryRetrieval
├── MemoryReinforcement
└── MemoryConsolidation
```

各部分负责：

### Formation

事件是否值得被记住。

### Decay

记忆随时间如何减弱。

### Retrieval

当前情境应该想起什么。

### Reinforcement

回忆之后是否强化。

### Consolidation

短期记忆是否进入长期记忆。

---

# 15. Memory Record

不应该直接保存大量原始对话作为角色记忆。

应保存结构化 Memory Record：

```typescript
interface MemoryRecord {
  id: string;

  type: MemoryType;

  content: string;

  createdAt: GameTimestamp;

  importance: number;
  emotionalIntensity: number;
  valence: number;

  strength: number;

  tags: string[];

  relatedCharacters: CharacterId[];

  lastRetrievedAt?: GameTimestamp;
  retrievalCount: number;

  sourceTurnId: TurnId;
}
```

这样：

> **Memory 是角色脑中的一个结构化记忆对象，而不是简单的聊天记录。**

---

# 16. Context Engine

Memory 与 Context 应该分离。

Memory：

> 角色记得什么。

Context：

> 这一轮 AI 应该看到什么。

结构：

```text
ContextEngine
├── ContextBuilder
├── ContextBudget
├── MemoryRanker
├── StateSummarizer
└── PromptComposer
```

流程：

```text
GameState
   +
MemoryStore
   +
Current Event
   ↓
ContextBuilder
   ↓
ModelContext
```

---

# 17. Context Builder Interface

建议定义：

```typescript
interface ContextBuilder {
  build(input: ContextInput): Promise<ModelContext>;
}
```

以后可以根据模型创建不同实现：

```text
GPTContextBuilder
ClaudeContextBuilder
GeminiContextBuilder
LocalModelContextBuilder
```

因为不同模型可能具有：

- 不同 Context Window
- 不同 Tokenizer
- 不同 JSON 能力
- 不同 Prompt 偏好

---

# 18. LLM Gateway

Narrative Engine 不应该直接调用任何厂商 API。

应该采用：

```text
Narrative Engine
       ↓
LLM Gateway
       ↓
Provider Adapter
```

例如：

```text
LLMGateway
├── OpenAIAdapter
├── AnthropicAdapter
├── GeminiAdapter
├── OpenAICompatibleAdapter
└── LocalModelAdapter
```

统一接口：

```typescript
interface LLMGateway {
  generate(
    request: LLMRequest
  ): Promise<LLMResponse>;
}
```

这样未来切换：

- GPT
- Claude
- Gemini
- DeepSeek
- 本地模型

不需要修改核心游戏逻辑。

---

# 19. SillyTavern Adapter

SillyTavern 应该成为 Runtime Adapter，而不是 Game Core 的依赖。

结构：

```text
Game Core
     │
     ▼
RuntimePort
     │
     ├── SillyTavernAdapter
     ├── StandaloneAdapter
     └── TestRuntime
```

SillyTavern Adapter 负责：

```text
Character Card
World Book
Prompt Injection
Context Bridge
LLM Routing
Extension Communication
```

核心原则：

> **Game Core 不知道这些数据来自 SillyTavern。**

---

# 20. SillyTavern 的正确定位

SillyTavern 在整个系统中的定位：

> **AI Runtime / Character Runtime**

它负责：

- Character Card
- World Book / Lorebook
- Prompt
- Context
- LLM Connection
- AI Generation
- 既有 Extension 能力

而项目自己的框架负责：

- Game State
- Game Rules
- Options
- Parameter Resolution
- Memory
- RNG
- Day / Run
- Ending
- Save
- Design Mode
- Character Creator
- Export

因此：

> **SillyTavern Card 是一种导出/运行格式，而不是游戏内部唯一角色格式。**

---

# 21. UI Adapter

UI 同样应该与 Game Core 解耦。

结构：

```text
Game Engine
      ↓
Application API
      ↓
UI Adapter
```

未来可以提供：

```text
Web UI
SillyTavern UI
Desktop UI
CLI Debug UI
```

V1 可以从极简 Web UI 开始，后续逐渐实现：

- GAL 对话框
- 角色立绘
- 背景
- 状态栏
- 选项按钮
- Day / Progress UI
- 存档 UI
- Design Mode

---

# 22. Persistence Engine

存档系统不应该与 UI 或具体数据库绑定。

接口：

```typescript
interface SaveRepository {
  save(snapshot: GameSnapshot): Promise<void>;
  load(id: SaveId): Promise<GameSnapshot>;
  list(): Promise<SaveMetadata[]>;
  delete(id: SaveId): Promise<void>;
}
```

以后可以实现：

```text
FileSaveRepository
SQLiteSaveRepository
IndexedDBSaveRepository
```

---

# 23. V1 Persistence

第一版不需要数据库。

推荐：

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
    │   └── turn_003.json
    └── meta.json
```

后续稳定后可以迁移到 SQLite。

---

# 24. Schema Layer

项目高度依赖结构化数据，因此建议建立独立 Schema 层：

```text
schemas/
├── game-state.schema.json
├── character.schema.json
├── relationship.schema.json
├── option.schema.json
├── memory.schema.json
├── event.schema.json
├── prompt.schema.json
└── save.schema.json
```

这套 Schema 应作为整个系统的数据契约。

---

# 25. Schema Single Source of Truth

同一份 Schema 应服务于：

- Character Creator
- Validation
- Save
- Import
- Export
- Character Card Generator
- Prompt Generator
- API
- 测试

避免出现：

```text
前端一套字段
AI 一套字段
Save 一套字段
Character Card 又一套字段
```

否则后期会产生严重的数据兼容问题。

---

# 26. Design Mode

Character Creator / World Editor 等功能属于：

> **Design Application**

不是 Runtime Core。

结构：

```text
Design Mode
├── Character Editor
├── World Editor
├── Parameter Editor
├── Option Template Editor
├── Ending Editor
└── Prompt Editor
```

最终输出：

```text
Project Package
```

---

# 27. Project Package

一个完整的游戏应该是一个 Project，而不是几个散乱的 Character Card。

建议：

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

> **一个 Project = 一款可以设计、运行、保存、导出的 AI GALGAME。**

---

# 28. Character Compiler

角色编辑器中的统一角色定义，应通过 Character Compiler 生成不同 Runtime 需要的格式：

```text
Character Definition
        ↓
Character Compiler
        ↓
┌───────┼────────┐
↓       ↓        ↓
Card   World    Prompt
      Book
```

输出：

```text
Character Card
+
World Book
+
Game Character Definition
```

这样可以：

- 将角色导出给 SillyTavern
- 在独立 Runtime 中使用角色
- 在设计器中继续编辑
- 从现有 Character Card 反向导入

---

# 29. Application API

前端不应该直接调用内部 Service。

可以暴露 Application API：

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

## Start Turn

```json
{
  "runId": "run_017"
}
```

返回：

```json
{
  "turnId": "turn_124",
  "scene": {},
  "options": []
}
```

## Player Choice

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

UI 不需要知道 Memory、StateResolver 或 LLM Gateway 的内部实现。

---

# 30. Domain Event Bus

为了进一步降低模块耦合，后续可以加入：

> **Domain Event Bus**

例如：

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

模块只订阅自己需要的事件。

---

# 31. Domain Event 与 State 区分

状态：

```text
Affection = 63
```

事件：

```json
{
  "type": "AffectionChanged",
  "before": 60,
  "after": 63,
  "source": "choice_003"
}
```

Domain Event 的作用：

- Debug
- Replay
- Analytics
- State Audit
- 原因追踪
- Save History

例如：

> 为什么好感从 60 变成 63？

可以追溯：

```text
Turn
→ Choice
→ Modifier
→ Resolver
→ State Change
```

---

# 32. 模块依赖关系

建议严格遵循单向依赖：

```text
                    UI
                     │
                     ▼
              Application Layer
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        Game       Narrative   Memory
        Core       Services    Services
          │          │          │
          └──────────┼──────────┘
                     ▼
              Infrastructure
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
       LLM       Persistence    Runtime
    Adapter        Adapter      Adapter
```

禁止：

```text
GameCore → SillyTavern
```

应该是：

```text
SillyTavernAdapter → Ports / Application
```

---

# 33. 推荐项目目录

如果采用 TypeScript，推荐：

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

# 34. Monorepo vs Microservices

V1 推荐：

> **Monorepo + Modular Architecture**

即：

```text
一个项目
一个运行时
多个逻辑模块
```

而不是：

```text
World Server
Memory Server
LLM Server
Save Server
```

V1 无需微服务。

这样：

- 开发更快
- Debug 更简单
- Claude Code 更容易理解代码
- 本地运行方便
- 部署复杂度低

未来如果某个模块确实需要独立服务，再进行拆分。

---

# 35. 推荐技术栈

当前阶段可以将以下技术作为候选基线。

## Core

```text
TypeScript
```

理由：

- 类型系统适合复杂 Schema
- 前后端可以共享类型
- JSON 数据处理方便
- Web UI 友好
- 适合 SillyTavern Extension
- 后续 Desktop/Web 都容易扩展

## UI

```text
React
```

## Validation

```text
Zod
```

或者：

```text
JSON Schema + Zod
```

## Persistence

V1：

```text
JSON Files
```

后期：

```text
SQLite
```

## LLM

统一：

```text
LLM Gateway
```

支持：

```text
OpenAI-compatible API
Anthropic
Gemini
Local Model
```

---

# 36. RAG 的定位

RAG 不应该成为整个项目的核心。

它主要属于：

```text
Memory Retrieval
```

流程：

```text
Memory Store
    ↓
Candidate Retrieval
    ↓
Scoring
    ↓
Context Builder
```

不要：

```text
所有 Game State
↓
RAG
↓
LLM
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

应该直接注入 Context。

---

# 37. Memory Retrieval 可以采用 Hybrid Retrieval

未来可以组合：

```text
Memory Retrieval
├── Exact / Rule Filter
├── Metadata Filter
├── Recency
├── Importance
├── Semantic Similarity
└── Character-specific Bias
```

最终例如：

\[
Score =
w_rR+
w_iI+
w_sS+
w_eE+
w_oO
\]

其中：

- R：Recency
- I：Importance
- S：Semantic Similarity
- E：Emotion
- O：Obsession / Grudge Bias

---

# 38. 三层总体架构

整个项目可以进一步压缩成三层：

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

# 39. 产品层结构

目前的架构已经表明：

这个项目不应被定义为：

> 一个 SillyTavern 插件。

更准确的定义是：

> **AI GALGAME Development Framework**

可以包含三个主要产品形态：

```text
                 AI GALGAME Framework
                         │
           ┌─────────────┼──────────────┐
           ▼             ▼              ▼
       Designer        Runtime        Player
           │             │              │
       创建游戏          游戏运行         玩游戏
           │             │              │
      Character       Game State       Save
      World           AI               UI
      Rules           Memory           Export
      Prompts         RNG
```

SillyTavern：

> Runtime 的一个 Adapter / Implementation。

---

# 40. 下一阶段：Interface & Data Contract Design

软件架构下一步应进入：

> **Interface & Data Contract Design**

需要正式定义：

```text
GameState
CharacterState
RelationshipState
WorldState
Option
Event
Memory
Context
TurnResult
SaveSnapshot
```

以及以下服务：

```text
TurnOrchestrator
WorldEngine
EventEngine
OptionEngine
StateResolver
MemoryEngine
ContextBuilder
NarrativeEngine
EndingEngine
SaveManager
LLMGateway
SillyTavernAdapter
```

每一个接口都需要明确：

- Input
- Output
- 可修改状态
- 权限
- 错误类型
- 重试规则
- Rollback 规则
- LLM 调用点

---

# 41. 当前架构结论

当前阶段已经确定：

### 核心原则

1. **SillyTavern 是 Runtime Adapter，不是 Game Core。**
2. **Game State 拥有明确的数据所有权。**
3. **LLM 不能直接修改最终状态。**
4. **所有状态变化经过 State Resolver。**
5. **Memory 与 Context 是两个不同的系统。**
6. **UI 与 Core 解耦。**
7. **LLM Provider 与 Narrative Engine 解耦。**
8. **Persistence 与 Game Core 解耦。**
9. **Schema 是数据的 Single Source of Truth。**
10. **V1 使用 Monorepo + Modular Architecture，不使用微服务。**

---

# 42. Architecture Roadmap

下一阶段：

```text
Software Architecture
        ↓
Interface Design
        ↓
Data Contract / Schema
        ↓
Service API
        ↓
Prompt Architecture
        ↓
SillyTavern Adapter
        ↓
Prototype
```

其中第一优先级是：

> **GameState / CharacterState / RelationshipState / WorldState 的正式 TypeScript Interface + JSON Schema**

因为这些数据结构是整个系统的数据地基。

一旦 Schema 冻结，后续可以让 Claude Code / OpenCode 按照：

```text
Schema
→ Interface
→ Service
→ Test
→ Adapter
```

逐模块实现，而不是让 Coding Agent 自己猜测游戏架构。
