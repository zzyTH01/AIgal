# AI GALGAME Framework
## GameState / CharacterState / RelationshipState / WorldState
### Data Contract Design v0.1

---

# 1. Data Contract Design Goals

本阶段正式进入项目的数据契约设计。

核心目标：

- 定义 GameState 的根结构
- 定义 CharacterState
- 定义 RelationshipState
- 定义 WorldState
- 为后续 StateResolver、Memory Engine、Context Builder 和 Persistence 提供稳定的数据基础
- 同时提供 TypeScript Interface 与 JSON Schema
- 确保 AI 输出与核心游戏状态之间保持严格的数据边界

核心原则：

> **状态值与历史事件分离。**

例如：

```text
affection = 63
```

表示当前关系状态。

而：

```text
AffectionChanged {
    before: 60,
    after: 63,
    source: "turn_124"
}
```

属于 Event / History，不直接进入核心 State。

---

# 2. State 与 AI Context 分离

`GameState` 不保存完整 LLM Context。

正确关系：

```text
GameState
+
Memory
+
Current Event
+
Character Cognition
↓
ContextBuilder
↓
ModelContext
↓
LLM
```

因此：

> **GameState 是世界的权威状态；Context 是针对某一次 LLM 调用动态构建的派生数据。**

---

# 3. Shared TypeScript Types

首先建立共享类型：

```typescript
export type ID = string;

export type CharacterId = ID;
export type RelationshipId = ID;
export type EventId = ID;
export type TurnId = ID;
export type RunId = ID;
export type MemoryId = ID;
export type SaveId = ID;

export type NumericRange = {
  min: number;
  max: number;
};

export type GameTimestamp = {
  day: number;
  time: string; // HH:mm
};
```

---

# 4. GameState

GameState 是整个 Runtime 的根状态对象。

```typescript
export interface GameState {
  schemaVersion: string;

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

---

# 5. RunState

Run 表示一次独立的游戏生命周期。

```typescript
export interface RunState {
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

```typescript
export type RunStatus =
  | "not_started"
  | "active"
  | "paused"
  | "ending"
  | "completed"
  | "bad_end";
```

当前 V1：

```text
time = "HH:mm"
```

后续如果需要精细时间模拟，可以升级为：

```typescript
time: {
  hour: number;
  minute: number;
}
```

---

# 6. CharacterState

CharacterState 是整个系统最重要的数据结构之一。

推荐拆分为：

```text
CharacterState
├── identity
├── personality
├── psychology
├── emotion
├── cognition
├── physical
└── activity
```

正式接口：

```typescript
export interface CharacterState {
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

# 7. CharacterIdentity

```typescript
export interface CharacterIdentity {
  name: string;

  age: number;

  gender?: string;

  genderIdentity?: string;

  sexualOrientation?: string;

  role?: string;

  description?: string;
}
```

这里不将性别、性别认同和性取向强制限制为固定 enum，而使用字符串，方便 Character Creator 支持更加灵活的角色定义。

---

# 8. PersonalityState

Personality 是角色相对稳定的长期人格。

```typescript
export interface PersonalityState {
  traits: Record<string, number>;

  independence: number;

  confidence: number;

  sociability: number;

  sensitivity: number;

  assertiveness: number;

  empathy: number;

  openness: number;
}
```

建议：

```text
0 = 极低
100 = 极高
```

例如：

```text
independence = 80
confidence = 40
sensitivity = 75
```

---

# 9. PsychologyState

Psychology 是会随着互动、事件和环境持续变化的心理状态。

```typescript
export interface PsychologyState {
  dependence: number;

  security: number;

  loneliness: number;

  stress: number;

  jealousy: number;

  selfWorth: number;

  emotionalStability: number;

  romanticTension: number;
}
```

Personality 与 Psychology 必须区分。

例如：

```text
Personality:
independence = 80
```

表示：

> 角色本身倾向独立。

而：

```text
Psychology:
dependence = 70
```

表示：

> 当前关系环境下，她可能已经形成较高程度的依赖。

---

# 10. EmotionState

Emotion 是更加短期、动态的状态。

```typescript
export interface EmotionState {
  primary: EmotionType;

  secondary?: EmotionType;

  intensity: number;

  valence: number;

  energy: number;
}
```

```typescript
export type EmotionType =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "afraid"
  | "anxious"
  | "embarrassed"
  | "excited"
  | "lonely"
  | "jealous"
  | "relieved"
  | "confused"
  | "disappointed"
  | "affectionate"
  | "other";
```

参数范围：

```text
intensity: 0~100
valence: -100~100
energy: 0~100
```

---

# 11. CognitionState

CognitionState 对应前面设计的角色认知系统。

它包括：

- 记忆容量
- 记忆编码
- 记忆保持
- 记忆检索
- 健忘
- 记仇
- 执念
- 注意力
- 情绪显著性
- 当前认知负荷

正式接口：

```typescript
export interface CognitionState {
  memoryCapacity: number;

  encoding: number;

  retention: number;

  retrieval: number;

  forgetfulness: number;

  grudge: number;

  obsession: number;

  attention: number;

  emotionalSalience: number;

  cognitiveLoad: number;
}
```

全部暂时采用：

```text
0~100
```

重要定义：

> `memoryCapacity` 不是 LLM 的真实 Context Window，而是角色本次认知过程能够访问多少历史信息的抽象能力。

---

# 12. PhysicalState

V1 暂时保持简单：

```typescript
export interface PhysicalState {
  energy: number;

  fatigue: number;

  health: number;

  hunger: number;

  sleepiness: number;
}
```

均采用：

```text
0~100
```

以后可以影响：

- Event Selection
- Option Generation
- Mood
- NPC Reaction
- Daily Progress

---

# 13. CharacterActivityState

表示角色当前在做什么，以及是否可以被玩家接触。

```typescript
export interface CharacterActivityState {
  locationId: string;

  activity?: string;

  availability: number;

  scheduleState?: string;

  currentGoal?: string;
}
```

示例：

```json
{
  "locationId": "library",
  "activity": "studying",
  "availability": 60,
  "scheduleState": "after_school",
  "currentGoal": "finish_assignment"
}
```

这样可以防止不符合世界状态的生成，例如：

> 角色正在考试时，却突然和玩家坐在咖啡厅聊天。

---

# 14. CharacterStatus

```typescript
export type CharacterStatus =
  | "active"
  | "unavailable"
  | "absent"
  | "asleep"
  | "disabled";
```

---

# 15. RelationshipState

RelationshipState 表示：

> 两个实体之间的关系，而不是某一个角色自身的状态。

```typescript
export interface RelationshipState {
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

  currentLabel?: string;

  tags: string[];

  status: RelationshipStatus;

  customMetrics?: Record<string, number>;
}
```

---

# 16. RelationshipType

关系类型不应该被设计得过于封闭。

```typescript
export type RelationshipType =
  | "unknown"
  | "stranger"
  | "acquaintance"
  | "friend"
  | "close_friend"
  | "romantic_interest"
  | "partner"
  | "family"
  | "rival"
  | "enemy"
  | "estranged"
  | "custom";
```

可以通过：

```text
type = "custom"
currentLabel = "暧昧对象"
```

产生自定义关系。

---

# 17. RelationshipStatus

```typescript
export type RelationshipStatus =
  | "active"
  | "strained"
  | "broken"
  | "ended";
```

---

# 18. Relationship Metrics

V1 建议使用：

```text
affection
trust
intimacy
familiarity
attraction
conflict
respect
dependency
```

全部：

```text
0~100
```

但：

> **不是所有 Relationship 都必须实际使用所有指标。**

例如：

### 普通朋友

```text
trust
familiarity
respect
```

### 恋爱关系

```text
affection
trust
intimacy
attraction
jealousy
```

### 对立关系

```text
conflict
respect
fear
```

因此增加：

```typescript
customMetrics?: Record<string, number>;
```

为 Character Creator 提供可扩展参数系统。

---

# 19. WorldState

WorldState 表示：

> **世界当前是什么状态。**

```typescript
export interface WorldState {
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

# 20. Weekday

```typescript
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
```

---

# 21. Season

```typescript
export type Season =
  | "spring"
  | "summer"
  | "autumn"
  | "winter";
```

---

# 22. WeatherState

```typescript
export interface WeatherState {
  type: WeatherType;

  intensity: number;

  temperature?: number;

  visibility?: number;
}
```

```typescript
export type WeatherType =
  | "clear"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "wind"
  | "other";
```

---

# 23. LocationState

```typescript
export interface LocationState {
  locationId: string;

  name: string;

  type: LocationType;

  tags: string[];

  accessibility: number;

  active: boolean;

  currentCharacters: CharacterId[];
}
```

```typescript
export type LocationType =
  | "home"
  | "school"
  | "classroom"
  | "library"
  | "park"
  | "shop"
  | "restaurant"
  | "street"
  | "workplace"
  | "private"
  | "other";
```

---

# 24. WorldEventState

WorldEventState 不是完整的 Narrative Event，而是：

> **当前世界中存在的事件实体。**

```typescript
export interface WorldEventState {
  eventId: EventId;

  type: string;

  title?: string;

  startDay: number;

  endDay?: number;

  locationIds?: string[];

  characterIds?: CharacterId[];

  importance: number;

  active: boolean;

  tags: string[];
}
```

---

# 25. PlayerModel

PlayerModel 记录角色对玩家形成的主观认知。

```typescript
export interface PlayerModel {
  perceivedTraits: Record<string, number>;

  perceivedIntentions: Record<string, number>;

  behavioralPatterns: Record<string, number>;

  recentBehaviorPattern: string[];

  reliability: number;

  honesty: number;

  caring: number;

  confidence: number;

  romanticInterest: number;

  perceivedControl: number;
}
```

重要原则：

> `PlayerModel` 不是玩家的客观属性。

它是：

> **角色认为玩家是什么样的人。**

因此不同角色可以对同一个玩家形成不同的 Player Model。

---

# 26. MemoryState

GameState 不应该只保存：

```text
MemoryRecord[]
```

而应该显式维护不同记忆层级：

```typescript
export interface MemoryState {
  records: Record<MemoryId, MemoryRecord>;

  shortTermIds: MemoryId[];

  longTermIds: MemoryId[];

  forgottenIds: MemoryId[];

  lastConsolidatedDay: number;
}
```

---

# 27. MemoryRecord

```typescript
export interface MemoryRecord {
  id: MemoryId;

  type: MemoryType;

  content: string;

  createdAt: GameTimestamp;

  importance: number;

  emotionalIntensity: number;

  valence: number;

  strength: number;

  accuracy: number;

  tags: string[];

  relatedCharacters: CharacterId[];

  sourceTurnId: TurnId;

  retrievalCount: number;

  lastRetrievedAt?: GameTimestamp;
}
```

---

# 28. MemoryType

```typescript
export type MemoryType =
  | "episodic"
  | "semantic"
  | "emotional"
  | "social";
```

---

# 29. MetaState

MetaState 表示跨 Run 持久化内容。

```typescript
export interface MetaState {
  runCount: number;

  completedRuns: number;

  knowledge: Record<string, KnowledgeRecord>;

  memories: MetaMemoryRecord[];

  unlocks: string[];

  achievements: string[];

  endingsDiscovered: string[];

  permanentModifiers: Record<string, number>;
}
```

---

# 30. RNGState

Roguelike 系统需要保存 RNG 状态，以支持复现。

```typescript
export interface RNGState {
  seed: number;

  state: number[];

  algorithm: string;
}
```

例如：

```text
algorithm = "xorshift128"
```

这样可以保证：

> 同一个 Run 在相同 RNG 状态下可以复现。

---

# 31. 完整 GameState Aggregate

```typescript
export interface GameState {
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

---

# 32. 实际 GameState 示例

```json
{
  "schemaVersion": "0.1.0",

  "run": {
    "runId": "run_017",
    "startedAt": "2026-08-16T14:00:00+08:00",
    "day": 8,
    "turn": 124,
    "time": "16:40",
    "dailyProgress": 8,
    "dailyProgressLimit": 10,
    "currentEventId": "event_library_001",
    "currentLocationId": "library",
    "status": "active"
  },

  "world": {
    "day": 8,
    "time": "16:40",
    "weekday": "sunday",
    "season": "summer",

    "weather": {
      "type": "rain",
      "intensity": 60,
      "temperature": 24
    },

    "currentLocationId": "library",

    "locations": {
      "library": {
        "locationId": "library",
        "name": "Library",
        "type": "library",
        "tags": ["quiet", "study"],
        "accessibility": 100,
        "active": true,
        "currentCharacters": ["heroine_001"]
      }
    },

    "publicEvents": [],

    "activeEvents": []
  },

  "characters": {
    "heroine_001": {
      "characterId": "heroine_001",

      "identity": {
        "name": "Heroine",
        "age": 20,
        "gender": "female",
        "role": "student"
      },

      "personality": {
        "traits": {
          "kind": 80,
          "shy": 70
        },
        "independence": 80,
        "confidence": 60,
        "sociability": 40,
        "sensitivity": 75,
        "assertiveness": 30,
        "empathy": 85,
        "openness": 55
      },

      "psychology": {
        "dependence": 20,
        "security": 60,
        "loneliness": 60,
        "stress": 50,
        "jealousy": 20,
        "selfWorth": 55,
        "emotionalStability": 65,
        "romanticTension": 50
      },

      "emotion": {
        "primary": "anxious",
        "secondary": "lonely",
        "intensity": 60,
        "valence": -20,
        "energy": 40
      },

      "cognition": {
        "memoryCapacity": 80,
        "encoding": 75,
        "retention": 70,
        "retrieval": 80,
        "forgetfulness": 30,
        "grudge": 40,
        "obsession": 20,
        "attention": 65,
        "emotionalSalience": 75,
        "cognitiveLoad": 35
      },

      "physical": {
        "energy": 40,
        "fatigue": 60,
        "health": 95,
        "hunger": 30,
        "sleepiness": 40
      },

      "activity": {
        "locationId": "library",
        "activity": "studying",
        "availability": 60,
        "scheduleState": "after_school",
        "currentGoal": "finish_assignment"
      },

      "status": "active"
    }
  },

  "relationships": {
    "rel_001": {
      "relationshipId": "rel_001",
      "sourceId": "player",
      "targetId": "heroine_001",

      "type": "romantic_interest",

      "affection": 63,
      "trust": 53,
      "intimacy": 49,
      "familiarity": 65,
      "attraction": 55,
      "conflict": 10,
      "respect": 72,
      "dependency": 20,

      "customMetrics": {},

      "currentLabel": "暧昧对象",

      "tags": ["close", "developing"],

      "status": "active"
    }
  },

  "flags": {
    "met_heroine": true,
    "library_unlocked": true
  },

  "playerModel": {
    "perceivedTraits": {
      "kind": 70,
      "reliable": 60
    },

    "perceivedIntentions": {
      "care": 75,
      "romantic": 55
    },

    "behavioralPatterns": {
      "help": 7,
      "flirt": 3,
      "avoid": 2
    },

    "recentBehaviorPattern": [
      "help",
      "support",
      "probe_emotion"
    ],

    "reliability": 62,
    "honesty": 70,
    "caring": 75,
    "confidence": 55,
    "romanticInterest": 60,
    "perceivedControl": 20
  },

  "memories": {
    "records": {},
    "shortTermIds": [],
    "longTermIds": [],
    "forgottenIds": [],
    "lastConsolidatedDay": 7
  },

  "meta": {
    "runCount": 17,
    "completedRuns": 8,
    "knowledge": {},
    "memories": [],
    "unlocks": [],
    "achievements": [],
    "endingsDiscovered": [],
    "permanentModifiers": {}
  },

  "rng": {
    "seed": 382917,
    "state": [123, 456, 789, 321],
    "algorithm": "xorshift128"
  }
}
```

---

# 33. JSON Schema：GameState

本项目建议使用：

> **JSON Schema Draft 2020-12**

核心结构：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/ai-galgame/schemas/game-state.schema.json",
  "title": "GameState",
  "type": "object",
  "required": [
    "schemaVersion",
    "run",
    "world",
    "characters",
    "relationships",
    "flags",
    "playerModel",
    "memories",
    "meta",
    "rng"
  ]
}
```

完整 Schema 应在项目中单独保存为：

```text
schemas/game-state.schema.json
```

下面定义主要结构。

---

# 34. JSON Schema：RunState

```json
{
  "RunState": {
    "type": "object",
    "required": [
      "runId",
      "startedAt",
      "day",
      "turn",
      "time",
      "dailyProgress",
      "dailyProgressLimit",
      "currentLocationId",
      "status"
    ],
    "properties": {
      "runId": {
        "type": "string"
      },
      "startedAt": {
        "type": "string",
        "format": "date-time"
      },
      "day": {
        "type": "integer",
        "minimum": 1
      },
      "turn": {
        "type": "integer",
        "minimum": 0
      },
      "time": {
        "type": "string",
        "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d$"
      },
      "dailyProgress": {
        "type": "number",
        "minimum": 0
      },
      "dailyProgressLimit": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "currentEventId": {
        "type": "string"
      },
      "currentLocationId": {
        "type": "string"
      },
      "status": {
        "enum": [
          "not_started",
          "active",
          "paused",
          "ending",
          "completed",
          "bad_end"
        ]
      }
    },
    "additionalProperties": false
  }
}
```

---

# 35. JSON Schema：CharacterState

```json
{
  "CharacterState": {
    "type": "object",
    "required": [
      "characterId",
      "identity",
      "personality",
      "psychology",
      "emotion",
      "cognition",
      "physical",
      "activity",
      "status"
    ],
    "properties": {
      "characterId": {
        "type": "string"
      },
      "identity": {
        "$ref": "#/$defs/CharacterIdentity"
      },
      "personality": {
        "$ref": "#/$defs/PersonalityState"
      },
      "psychology": {
        "$ref": "#/$defs/PsychologyState"
      },
      "emotion": {
        "$ref": "#/$defs/EmotionState"
      },
      "cognition": {
        "$ref": "#/$defs/CognitionState"
      },
      "physical": {
        "$ref": "#/$defs/PhysicalState"
      },
      "activity": {
        "$ref": "#/$defs/CharacterActivityState"
      },
      "status": {
        "enum": [
          "active",
          "unavailable",
          "absent",
          "asleep",
          "disabled"
        ]
      }
    },
    "additionalProperties": false
  }
}
```

---

# 36. JSON Schema：CharacterIdentity

```json
{
  "CharacterIdentity": {
    "type": "object",
    "required": [
      "name",
      "age"
    ],
    "properties": {
      "name": {
        "type": "string",
        "minLength": 1
      },
      "age": {
        "type": "integer",
        "minimum": 18
      },
      "gender": {
        "type": "string"
      },
      "genderIdentity": {
        "type": "string"
      },
      "sexualOrientation": {
        "type": "string"
      },
      "role": {
        "type": "string"
      },
      "description": {
        "type": "string"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 37. JSON Schema：PersonalityState

```json
{
  "PersonalityState": {
    "type": "object",
    "required": [
      "traits",
      "independence",
      "confidence",
      "sociability",
      "sensitivity",
      "assertiveness",
      "empathy",
      "openness"
    ],
    "properties": {
      "traits": {
        "type": "object",
        "additionalProperties": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      },
      "independence": {
        "$ref": "#/$defs/Percent"
      },
      "confidence": {
        "$ref": "#/$defs/Percent"
      },
      "sociability": {
        "$ref": "#/$defs/Percent"
      },
      "sensitivity": {
        "$ref": "#/$defs/Percent"
      },
      "assertiveness": {
        "$ref": "#/$defs/Percent"
      },
      "empathy": {
        "$ref": "#/$defs/Percent"
      },
      "openness": {
        "$ref": "#/$defs/Percent"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 38. JSON Schema：PsychologyState

```json
{
  "PsychologyState": {
    "type": "object",
    "required": [
      "dependence",
      "security",
      "loneliness",
      "stress",
      "jealousy",
      "selfWorth",
      "emotionalStability",
      "romanticTension"
    ],
    "properties": {
      "dependence": {
        "$ref": "#/$defs/Percent"
      },
      "security": {
        "$ref": "#/$defs/Percent"
      },
      "loneliness": {
        "$ref": "#/$defs/Percent"
      },
      "stress": {
        "$ref": "#/$defs/Percent"
      },
      "jealousy": {
        "$ref": "#/$defs/Percent"
      },
      "selfWorth": {
        "$ref": "#/$defs/Percent"
      },
      "emotionalStability": {
        "$ref": "#/$defs/Percent"
      },
      "romanticTension": {
        "$ref": "#/$defs/Percent"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 39. JSON Schema：EmotionState

```json
{
  "EmotionState": {
    "type": "object",
    "required": [
      "primary",
      "intensity",
      "valence",
      "energy"
    ],
    "properties": {
      "primary": {
        "$ref": "#/$defs/EmotionType"
      },
      "secondary": {
        "$ref": "#/$defs/EmotionType"
      },
      "intensity": {
        "$ref": "#/$defs/Percent"
      },
      "valence": {
        "type": "number",
        "minimum": -100,
        "maximum": 100
      },
      "energy": {
        "$ref": "#/$defs/Percent"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 40. JSON Schema：CognitionState

```json
{
  "CognitionState": {
    "type": "object",
    "required": [
      "memoryCapacity",
      "encoding",
      "retention",
      "retrieval",
      "forgetfulness",
      "grudge",
      "obsession",
      "attention",
      "emotionalSalience",
      "cognitiveLoad"
    ],
    "properties": {
      "memoryCapacity": {
        "$ref": "#/$defs/Percent"
      },
      "encoding": {
        "$ref": "#/$defs/Percent"
      },
      "retention": {
        "$ref": "#/$defs/Percent"
      },
      "retrieval": {
        "$ref": "#/$defs/Percent"
      },
      "forgetfulness": {
        "$ref": "#/$defs/Percent"
      },
      "grudge": {
        "$ref": "#/$defs/Percent"
      },
      "obsession": {
        "$ref": "#/$defs/Percent"
      },
      "attention": {
        "$ref": "#/$defs/Percent"
      },
      "emotionalSalience": {
        "$ref": "#/$defs/Percent"
      },
      "cognitiveLoad": {
        "$ref": "#/$defs/Percent"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 41. JSON Schema：RelationshipState

```json
{
  "RelationshipState": {
    "type": "object",
    "required": [
      "relationshipId",
      "sourceId",
      "targetId",
      "type",
      "affection",
      "trust",
      "intimacy",
      "familiarity",
      "attraction",
      "conflict",
      "respect",
      "dependency",
      "tags",
      "status"
    ],
    "properties": {
      "relationshipId": {
        "type": "string"
      },
      "sourceId": {
        "type": "string"
      },
      "targetId": {
        "type": "string"
      },
      "type": {
        "$ref": "#/$defs/RelationshipType"
      },
      "affection": {
        "$ref": "#/$defs/Percent"
      },
      "trust": {
        "$ref": "#/$defs/Percent"
      },
      "intimacy": {
        "$ref": "#/$defs/Percent"
      },
      "familiarity": {
        "$ref": "#/$defs/Percent"
      },
      "attraction": {
        "$ref": "#/$defs/Percent"
      },
      "conflict": {
        "$ref": "#/$defs/Percent"
      },
      "respect": {
        "$ref": "#/$defs/Percent"
      },
      "dependency": {
        "$ref": "#/$defs/Percent"
      },
      "customMetrics": {
        "type": "object",
        "additionalProperties": {
          "type": "number"
        }
      },
      "currentLabel": {
        "type": "string"
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "status": {
        "enum": [
          "active",
          "strained",
          "broken",
          "ended"
        ]
      }
    },
    "additionalProperties": false
  }
}
```

---

# 42. JSON Schema：WorldState

```json
{
  "WorldState": {
    "type": "object",
    "required": [
      "day",
      "time",
      "weekday",
      "season",
      "weather",
      "currentLocationId",
      "locations",
      "publicEvents",
      "activeEvents"
    ],
    "properties": {
      "day": {
        "type": "integer",
        "minimum": 1
      },
      "time": {
        "type": "string",
        "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d$"
      },
      "weekday": {
        "$ref": "#/$defs/Weekday"
      },
      "season": {
        "$ref": "#/$defs/Season"
      },
      "weather": {
        "$ref": "#/$defs/WeatherState"
      },
      "currentLocationId": {
        "type": "string"
      },
      "locations": {
        "type": "object",
        "additionalProperties": {
          "$ref": "#/$defs/LocationState"
        }
      },
      "publicEvents": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/WorldEventState"
        }
      },
      "activeEvents": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/WorldEventState"
        }
      },
      "worldFlags": {
        "type": "object",
        "additionalProperties": {
          "type": [
            "boolean",
            "number",
            "string"
          ]
        }
      }
    },
    "additionalProperties": false
  }
}
```

---

# 43. JSON Schema：MemoryState

```json
{
  "MemoryState": {
    "type": "object",
    "required": [
      "records",
      "shortTermIds",
      "longTermIds",
      "forgottenIds",
      "lastConsolidatedDay"
    ],
    "properties": {
      "records": {
        "type": "object",
        "additionalProperties": {
          "$ref": "#/$defs/MemoryRecord"
        }
      },
      "shortTermIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "longTermIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "forgottenIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "lastConsolidatedDay": {
        "type": "integer",
        "minimum": 0
      }
    },
    "additionalProperties": false
  }
}
```

---

# 44. JSON Schema：MemoryRecord

```json
{
  "MemoryRecord": {
    "type": "object",
    "required": [
      "id",
      "type",
      "content",
      "createdAt",
      "importance",
      "emotionalIntensity",
      "valence",
      "strength",
      "accuracy",
      "tags",
      "relatedCharacters",
      "sourceTurnId",
      "retrievalCount"
    ],
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "$ref": "#/$defs/MemoryType"
      },
      "content": {
        "type": "string"
      },
      "createdAt": {
        "$ref": "#/$defs/GameTimestamp"
      },
      "importance": {
        "$ref": "#/$defs/Percent"
      },
      "emotionalIntensity": {
        "$ref": "#/$defs/Percent"
      },
      "valence": {
        "type": "number",
        "minimum": -100,
        "maximum": 100
      },
      "strength": {
        "$ref": "#/$defs/Percent"
      },
      "accuracy": {
        "$ref": "#/$defs/Percent"
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "relatedCharacters": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "sourceTurnId": {
        "type": "string"
      },
      "retrievalCount": {
        "type": "integer",
        "minimum": 0
      },
      "lastRetrievedAt": {
        "$ref": "#/$defs/GameTimestamp"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 45. JSON Schema：MetaState

```json
{
  "MetaState": {
    "type": "object",
    "required": [
      "runCount",
      "completedRuns",
      "knowledge",
      "memories",
      "unlocks",
      "achievements",
      "endingsDiscovered",
      "permanentModifiers"
    ],
    "properties": {
      "runCount": {
        "type": "integer",
        "minimum": 0
      },
      "completedRuns": {
        "type": "integer",
        "minimum": 0
      },
      "knowledge": {
        "type": "object",
        "additionalProperties": {
          "$ref": "#/$defs/KnowledgeRecord"
        }
      },
      "memories": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/MetaMemoryRecord"
        }
      },
      "unlocks": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "achievements": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "endingsDiscovered": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "permanentModifiers": {
        "type": "object",
        "additionalProperties": {
          "type": "number"
        }
      }
    },
    "additionalProperties": false
  }
}
```

---

# 46. JSON Schema：RNGState

```json
{
  "RNGState": {
    "type": "object",
    "required": [
      "seed",
      "state",
      "algorithm"
    ],
    "properties": {
      "seed": {
        "type": "integer"
      },
      "state": {
        "type": "array",
        "items": {
          "type": "integer"
        }
      },
      "algorithm": {
        "type": "string"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 47. Shared JSON Schema Definitions

通用百分比：

```json
{
  "Percent": {
    "type": "number",
    "minimum": 0,
    "maximum": 100
  }
}
```

时间：

```json
{
  "GameTimestamp": {
    "type": "object",
    "required": [
      "day",
      "time"
    ],
    "properties": {
      "day": {
        "type": "integer",
        "minimum": 1
      },
      "time": {
        "type": "string",
        "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d$"
      }
    },
    "additionalProperties": false
  }
}
```

---

# 48. 成年角色边界

CharacterIdentity 的 Schema 中：

```json
{
  "age": {
    "type": "integer",
    "minimum": 18
  }
}
```

因此：

> **第一版 Runtime 的角色数据层只允许成年角色进入关系系统。**

这为后续成熟向内容提供清晰的数据层边界。

---

# 49. 四个核心 State 的层级关系

最终关系：

```text
GameState
│
├── RunState
│
├── WorldState
│
├── CharacterStates
│       │
│       ├── Personality
│       ├── Psychology
│       ├── Emotion
│       ├── Cognition
│       ├── Physical
│       └── Activity
│
├── RelationshipStates
│       │
│       ├── Affection
│       ├── Trust
│       ├── Intimacy
│       ├── Familiarity
│       ├── Attraction
│       ├── Conflict
│       ├── Respect
│       └── Dependency
│
├── PlayerModel
│
├── MemoryState
│
├── MetaState
│
└── RNGState
```

可以用四句话概括：

### CharacterState

> **她是谁，以及她现在是什么状态。**

### RelationshipState

> **我和她之间是什么状态。**

### WorldState

> **世界现在是什么状态。**

### GameState

> **这一局游戏此刻的完整状态。**

---

# 50. 不要让 CharacterState 无限膨胀

后续不要把所有角色数据全部塞进 CharacterState。

例如未来可能出现：

```text
career
inventory
skills
goals
secrets
preferences
beliefs
memories
```

不应该全部继续添加到：

```text
CharacterState
```

未来可以逐步拆成：

```text
CharacterDefinition
CharacterState
CharacterCognition
CharacterInventory
CharacterGoals
CharacterSecrets
```

当前 V1 暂时聚合，是为了快速建立清晰的数据地基。

---

# 51. 下一阶段

现在四个核心 State 已经拥有第一版正式接口与 Schema 骨架。

下一步最关键的数据契约是：

```text
Option
Event
MemoryRecord
TurnResult
StateDelta
Context
SaveSnapshot
```

其中优先级最高：

> **Option + StateDelta + Event**

因为它们直接连接：

```text
AI生成
↓
玩家选择
↓
StateResolver
↓
GameState变化
```

尤其是：

# StateDelta

它需要正式定义：

> 一个玩家行为或 NPC 反应，究竟如何表达其对好感、信任、行动点、角色心理、世界状态、记忆和 FLAG 的影响。

一旦 `StateDelta` 正式确定，StateResolver 就可以真正开始工程化实现。

---

# 52. 当前 Data Contract 状态

已经基本确定：

- GameState 根结构
- RunState
- CharacterState
- PersonalityState
- PsychologyState
- EmotionState
- CognitionState
- PhysicalState
- CharacterActivityState
- RelationshipState
- RelationshipType
- WorldState
- WeatherState
- LocationState
- WorldEventState
- PlayerModel
- MemoryState
- MemoryRecord
- MetaState
- RNGState

尚未冻结：

- Option Schema
- Event Schema
- StateDelta Schema
- TurnResult Schema
- Context Schema
- SaveSnapshot Schema
- CharacterDefinition Schema
- Project Schema

这些将作为下一阶段的 Data Contract。
