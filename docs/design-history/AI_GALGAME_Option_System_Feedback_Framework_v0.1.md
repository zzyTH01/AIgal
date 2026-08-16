# AI GALGAME Framework
## Option System & Closed-Loop Narrative Feedback Framework
### Design Document v0.1

---

# 1. Overview

本阶段设计建立在前一阶段的 Game State Design 之上，核心目标是定义：

1. **选项系统（Option System）**
2. **状态反馈框架（Feedback Framework）**
3. **AI 与游戏状态之间的闭环**
4. **Memory Engine 与 Context Builder**
5. **核心模块划分**

项目的核心思想是：

> 玩家通过离散的行为选项与 AI 角色持续互动；每一次互动都会改变关系、人格、世界和时间状态，而这些状态又反过来决定 AI 下一次能够生成什么，从而形成持续的动态叙事循环。

因此，本项目不是简单的：

> AI Chat + GAL UI

而是：

> **以 SillyTavern 为 AI Runtime，以 Game State 为核心，以 Option 为玩家行为接口，以 Feedback Framework 驱动持续世界演化的 AI Roguelike GALGAME Framework。**

---

# 2. 核心设计原则

## 2.1 AI 负责生成，游戏引擎负责规则

这是整个系统最重要的原则。

### AI 可以负责

- 当前场景发生什么
- NPC 如何说话
- NPC 对玩家行为产生什么样的自然语言反应
- 根据角色和世界状态生成候选选项
- 生成动态事件
- 生成角色的情绪、意图等结构化候选信息
- 根据当前上下文提出潜在记忆

### AI 不直接拥有最终决定权

以下内容必须由游戏引擎控制：

- 好感度最终数值
- 信任度最终数值
- 角色参数最终数值
- 行动点 / Daily Progress
- Day 是否结束
- Ending / Bad End 判定
- 存档
- Meta Progression
- 合法性检查
- 状态数值上下限

因此：

> **AI 可以提出结果，State Resolver 才能确认结果。**

---

# 3. Closed-Loop Narrative Feedback Framework

整个项目的核心技术框架是一个持续反馈闭环。

```text
                 ┌────────────────────┐
                 │     World State    │
                 └─────────┬──────────┘
                           │
                 ┌─────────▼──────────┐
                 │  Character State   │
                 └─────────┬──────────┘
                           │
                 ┌─────────▼──────────┐
                 │ Relationship State │
                 └─────────┬──────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ AI Director │
                    └──────┬──────┘
                           │
                  Generate Scenario
                           │
                           ▼
                    ┌─────────────┐
                    │    Option   │
                    │  Generator  │
                    └──────┬──────┘
                           │
                     玩家看到选项
                           │
                           ▼
                      玩家选择
                           │
                           ▼
                  ┌────────────────┐
                  │ State Resolver │
                  └───────┬────────┘
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
      World变化       Character变化    Relationship变化
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                  ┌────────────────┐
                  │ Memory Engine  │
                  └───────┬────────┘
                          ▼
                 Context Builder
                          ▼
                         LLM
                          │
                          └──────────────→ 下一轮
```

这个闭环意味着：

> 当前状态决定 AI 生成内容，玩家选择改变状态，新状态继续决定下一轮内容。

因此游戏不会依赖一套固定、预先写死的剧情树。

---

# 4. Option System

## 4.1 Option 的基本定义

传统 GAL 中，一个选项通常只是字符串：

```text
“陪她去图书馆”
```

在本项目中，一个选项应该是：

> **Behavior Object / 行为对象**

也就是说：

```text
Option
├── 表现文本
├── 行为标签
├── 行动点影响
├── 参数影响
├── 风险
├── 条件
├── 目标
├── 情绪倾向
├── 社交意图
└── AI生成约束
```

因此：

> 玩家实际上不是在选择一句台词，而是在选择一种行为。

---

# 5. Option 的两层结构

## 5.1 第一层：Intent / Behavior

这一层描述玩家做了什么，而不是具体说了什么。

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

例如：

```json
{
  "behavior": [
    "support",
    "respect",
    "encourage_independence"
  ]
}
```

---

## 5.2 第二层：Outcome Profile

这一层提供行为的基础影响倾向。

例如：

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

但这里的 `base` 不是最终结果。

最终结果应该由：

```text
Behavior
+
Character Personality
+
Character Current State
+
Relationship State
+
World Context
```

共同计算。

---

# 6. 动态结果计算

建议将状态变化抽象为：

\[
\Delta S = f(B,P,C,R,W)
\]

其中：

- \(B\)：Behavior，玩家行为
- \(P\)：Personality，角色人格
- \(C\)：Character Current State，角色当前状态
- \(R\)：Relationship，当前关系
- \(W\)：World，当前世界环境

因此同一个选项可以对不同角色产生完全不同的结果。

## 示例：相同的行为，不同结果

玩家选择：

> “我来帮你吧。”

### 角色 A

```text
independence = 20
dependence = 80
```

可能产生：

```text
Trust +3
Affection +4
Dependence +5
```

### 角色 B

```text
independence = 90
confidence = 80
```

可能产生：

```text
Trust +1
Affection +1
Independence -3
```

甚至可能出现：

> “你是不是觉得我什么都做不好？”

最终：

```text
Affection -1
Trust -2
Stress +8
```

因此：

> **选项本身不决定结果，角色状态参与决定结果。**

---

# 7. Option Semantic Layer

一个选项除了行为，还应该拥有语义层。

建议包括：

```text
Behavior
Intent
Tone
Risk
```

例如：

```json
{
  "behavior": ["help"],
  "intent": ["care"],
  "tone": "gentle",
  "risk": "low"
}
```

AI 可以根据这些数据生成自然语言：

> “我来帮你吧。”

也可以生成：

> “放着吧，我来处理。”

或者：

> “你今天状态不太好，我帮你弄完。”

底层行为可以一致，但表现文本可以不同。

核心原则：

> **规则与语言表现分离。**

---

# 8. Option Generation Pipeline

选项生成建议分成两个阶段。

## 8.1 Phase A：Option Planning

游戏引擎向 AI 提供结构化要求，例如：

```text
生成 3~4 个选项。

要求：
- 至少 1 个正向选项
- 至少 1 个中性/保守选项
- 至少 1 个社交/关系选项
- 至少 1 个风险选项
- Daily Progress 范围：1~4
- 必须符合角色当前人格和情绪
- 必须符合当前世界状态
```

AI 首先规划选项类型：

```text
Option A
support + low risk

Option B
flirt + medium risk

Option C
avoid + low risk

Option D
challenge + high risk
```

---

## 8.2 Phase B：Option Realization

再将规划好的行为转化成玩家实际看到的自然语言。

例如：

```text
support + low risk
```

最终生成：

> “要不要我陪你一起去？”

因此：

> AI 先决定“这个选项是什么”，再决定“这个选项怎么说”。

---

# 9. Option Diversity Constraint

防止 AI 产生四个本质相同的选项。

错误示例：

```text
A. 陪她
B. 帮她
C. 和她一起
D. 陪她去
```

推荐每轮至少覆盖：

```text
1. 主动行为
2. 保守行为
3. 社交 / 关系行为
4. 风险行为
```

例如：

```text
A. 陪她去图书馆
B. 让她自己安静一会儿
C. 开玩笑问她是不是在等你
D. 直接询问她最近是不是遇到了什么事
```

这样每个选项才代表真实的决策差异。

---

# 10. State Resolver

玩家选择之后，不能直接进行：

```text
affection += 5
```

而应该：

```text
Choice
↓
Behavior Parser
↓
Context Evaluation
↓
State Resolver
```

例如：

```text
Behavior:
tease
flirt
probe_emotion

Character:
sensitivity = 70
romantic_interest = 50
stress = 10

Relationship:
affection = 63
trust = 51

World:
private_location = true
```

最终得到：

```text
Affection +4
Trust +1
Romantic Tension +6
Embarrassment +12
```

---

# 11. State Resolution Model

建议采用：

> **基础值 + 多层修正器**

可以抽象为：

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
\]

例如：

```text
基础好感：+3

角色性格修正：1.2
当前关系修正：1.1
当前情绪修正：0.7
环境修正：1.3
```

最终：

\[
3 \times 1.2 \times 1.1 \times 0.7 \times 1.3
\approx 3.6
\]

最终取整：

```text
Affection +4
```

这样可以方便后续进行游戏平衡。

---

# 12. 非线性反馈

关系成长不应该完全线性。

例如：

- 好感很低时，一个小小的正向行为可能意义很大
- 好感中等时，同样行为作用正常
- 好感非常高时，重复行为的边际收益下降

因此：

\[
\Delta A = Base \times f(Affection)
\]

使状态在接近上限/下限时产生边际收益衰减。

目的是避免：

> 反复选择同一种选项就可以机械刷满好感。

---

# 13. 行为重复与边际收益

应记录玩家行为模式，例如：

```json
{
  "player_help": 7,
  "player_flirt": 3,
  "player_avoid": 2,
  "player_apologize": 1
}
```

以及最近行为：

```json
[
  "help",
  "help",
  "help"
]
```

系统就可以产生行为模式反馈：

> “你最近是不是过度保护我？”

甚至产生负反馈：

```text
第一次帮助：
Trust +5

第二次：
Trust +3

第三次：
Trust +1

第四次：
Trust -2
Independence -3
```

因此：

> **重复行为本身也是 Game State 的一部分。**

---

# 14. Player Model

角色不仅拥有自身状态，还应该逐渐形成对玩家的认知。

例如：

```text
Player Model
├── perceived_caring
├── perceived_honesty
├── perceived_reliability
├── perceived_confidence
├── perceived_selfishness
├── perceived_romantic_interest
└── perceived_control
```

这些不是玩家的客观属性，而是：

> **角色认为玩家是什么样的人。**

同一种行为可以被不同角色解释成完全不同的含义。

例如：

> “你早点回去休息吧。”

角色 A：

> “他在关心我。”

角色 B：

> “他是不是不想继续和我待在一起？”

角色 C：

> “他又在替我做决定。”

因此：

> **同一个 Input，可以产生不同的 State Update。**

---

# 15. Memory Formation

状态变化之后，应当进入 Memory Engine。

完整过程：

```text
Choice
↓
State Resolver
↓
Event Result
↓
Memory Formation
```

例如：

> 玩家今天没有选择陪她。

可能产生：

```text
Trust -4
Loneliness +5
```

同时形成记忆：

```text
“玩家在我需要陪伴的时候选择离开。”
```

其初始强度可以由以下因素共同决定：

\[
MemoryStrength_0 =
Importance
\times
EmotionalIntensity
\times
MemoryEncoding
\times
Grudge
\]

注意：

**并不是所有事件都会形成同等强度的记忆。**

---

# 16. AI 输出采用“双通道”

为了让自然语言和游戏状态解耦，AI 输出最好拆成两部分。

## 16.1 Natural Language Channel

给玩家看到：

> “我……其实只是有点失望。”

## 16.2 Structured Channel

给游戏引擎：

```json
{
  "emotion": "disappointed",
  "intensity": 0.65,
  "intent": "seek_reassurance",
  "memory_candidate": true
}
```

游戏引擎再次进行规则判断：

```text
Stress +5
Loneliness +3
```

因此：

> **LLM 负责提出解释，游戏引擎负责确认状态变化。**

---

# 17. Memory Engine 与 Context Builder

角色的记忆系统不能简单等同于 LLM 的完整上下文。

更合理的做法是：

> **建立一个虚拟认知层，让角色的“记忆力”决定历史信息如何被保留、检索和注入上下文。**

整体流程：

```text
Game History
↓
Memory Engine
↓
Memory Retrieval
↓
Context Builder
↓
LLM
```

---

# 18. Character Cognition

角色认知参数建议包括：

```text
Memory Capacity
Encoding
Retention
Retrieval
Forgetfulness
Grudge
Obsession
Attention
```

其中几个参数的意义不同。

## 18.1 Encoding

代表角色能否把事件编码成长期记忆。

受以下因素影响：

- 注意力
- 事件重要性
- 情绪强度

## 18.2 Retention

代表记忆能够保持多久。

## 18.3 Retrieval

代表角色在某个时刻是否能想起这段记忆。

因此：

> 记得 ≠ 当前想起来。

## 18.4 Forgetfulness

代表整体遗忘倾向。

## 18.5 Grudge

代表角色对负面事件的长期保持和再次激活倾向。

重要原则：

> **Memory Retention ≠ Grudge**

一个角色可以记性很好，但不记仇；也可以平时很健忘，但唯独非常记仇。

## 18.6 Obsession

代表特定记忆会不会不断重新占据注意力。

例如：

```text
Obsession = 95
```

意味着某些与核心执念相关的记忆，即使原始强度下降，也很容易重新被检索出来。

---

# 19. Memory Decay

可以为每个 Memory 维护 `Memory Strength`。

基础遗忘模型可以采用指数衰减：

\[
S(t)=S_0e^{-\lambda t}
\]

其中：

- \(S_0\)：初始记忆强度
- \(t\)：经过的时间
- \(\lambda\)：遗忘速度

而 \(\lambda\) 可以受到：

- Forgetfulness
- Retention
- Emotional Sensitivity
- Grudge
- Obsession

共同影响。

---

# 20. Memory Reinforcement

回忆本身应该重新强化记忆。

例如：

```text
Day 1
Memory Strength = 0.80
```

经过数天：

```text
Day 10
Memory Strength = 0.42
```

玩家突然问：

> “还记得我们第一次见面的时候吗？”

如果该记忆成功被检索：

```text
Memory Strength
0.42
↓
0.68
```

即：

> **Retrieval 本身会强化 Memory。**

---

# 21. Cognitive Context Budget

角色的“认知容量”不应直接修改模型真实的 Context Window。

正确的做法是：

> 在真正送入 LLM 之前，由 Context Builder 决定角色本次能够访问多少历史信息。

例如：

```text
Character Cognitive Capacity = 80
```

可以分配：

```text
System            15
Current State     15
Recent Events     20
Memories          20
Internal State    10
```

总计：

```text
80
```

另一角色：

```text
Cognitive Capacity = 40
```

则可能只有：

```text
System            15
Current State     10
Recent Events     10
Memory             5
```

因此：

> **“角色的记忆力”表现为这个角色能够进入 AI Context 的历史信息数量和质量，而不是修改 LLM 本身的上下文窗口。**

---

# 22. Memory Retrieval

Memory Retrieval 可以为每条记忆计算一个相关性分数：

\[
Score(m)=
w_1R+
w_2I+
w_3E+
w_4S+
w_5O
\]

其中：

- \(R\)：与当前情境的相关性
- \(I\)：事件重要性
- \(E\)：情绪强度
- \(S\)：当前记忆强度
- \(O\)：执念 / 记仇加成

最终选择 Top-K Memory 注入 Context。

---

# 23. 不同角色拥有不同的记忆风格

### 健忘型角色

```text
Forgetfulness = 80
Obsession = 10
```

更加依赖最近事件。

### 记仇型角色

```text
Forgetfulness = 30
Grudge = 90
```

旧的负面事件长期影响关系。

### 执念型角色

```text
Obsession = 95
```

某些特殊记忆会被反复检索。

### 理性型角色

```text
Emotional Sensitivity = 20
```

事实类记忆可能比情绪性记忆更重要。

---

# 24. Context Assembly Pipeline

LLM 不应直接读取整个 Game State，而应该经过 Context Builder。

推荐流程：

```text
Game State
↓
State Summarizer
↓
Memory Retriever
↓
Relevance Ranking
↓
Context Budget
↓
Prompt Composer
↓
LLM
```

---

# 25. Context 组成

建议至少包含以下部分：

## 25.1 System Rules

- 角色身份
- 角色行为规则
- 说话方式
- 世界规则
- 不可违反的约束

## 25.2 Current State

- Day
- Time
- Location
- Weather
- 角色当前状态
- 关系状态

## 25.3 Recent Events

最近 3~5 次事件。

## 25.4 Retrieved Memories

根据当前场景动态检索出的记忆。

## 25.5 Character Internal State

包括：

- 当前情绪
- 当前意图
- 潜在目标
- 隐藏心理

## 25.6 Generation Task

明确告诉 LLM：

- 当前需要生成剧情
- 当前需要生成角色反应
- 当前需要生成选项
- 当前需要判断情绪
- 当前需要提出结构化事件信息

---

# 26. Character Cognitive Profiles

因此不同角色可以拥有真正不同的“记忆风格”。

### A：记忆力强

```text
Cognitive Capacity = 100
Retrieval = 90
Retention = 90
```

能够保留更多历史关系细节。

### B：健忘

```text
Cognitive Capacity = 50
Retrieval = 40
Retention = 30
```

主要依赖近期互动和少量核心记忆。

### C：执念型

```text
Cognitive Capacity = 70
Retrieval = 60
Obsession = 95
```

可以忘掉普通事情，却反复回忆某一件核心事件。

---

# 27. 一轮交互的完整反馈循环

最终，一次互动可以被正式定义成：

```text
玩家选择
↓
Behavior
↓
State Resolver
↓
Relationship Change
↓
Character Psychology Change
↓
Emotion Change
↓
Memory Formation
↓
Player Model Update
↓
World State Update
↓
Context Builder
↓
AI
↓
新的场景
↓
新的选项
```

这就是游戏的：

> **Feedback Main Loop**

---

# 28. 核心技术架构

目前建议的核心模块：

```text
┌──────────────────────────────────────────────┐
│             AI GALGAME CORE                  │
│                                              │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │ World Engine │    │ Character Engine │   │
│  └──────┬───────┘    └────────┬─────────┘   │
│         │                     │             │
│         └──────────┬──────────┘             │
│                    ▼                        │
│          ┌──────────────────┐              │
│          │ Narrative Engine │              │
│          └────────┬─────────┘              │
│                   ▼                        │
│          ┌──────────────────┐              │
│          │ Option Generator │              │
│          └────────┬─────────┘              │
│                   ▼                        │
│                Player                     │
│                   │                        │
│                   ▼                        │
│          ┌──────────────────┐              │
│          │  State Resolver  │              │
│          └────────┬─────────┘              │
│                   ▼                        │
│          ┌──────────────────┐              │
│          │  Memory Engine   │              │
│          └────────┬─────────┘              │
│                   ▼                        │
│          ┌──────────────────┐              │
│          │ Context Builder  │──────────┐   │
│          └──────────────────┘          │   │
│                                        ▼   │
│                                      LLM   │
└──────────────────────────────────────────────┘
```

建议最终归纳成六个核心模块：

1. **World Engine**
2. **Character / Relationship Engine**
3. **Narrative & Option Engine**
4. **State Resolver**
5. **Memory Engine**
6. **Context Builder**

SillyTavern 在整体架构中的定位为：

> **AI Runtime / Character Runtime**

负责：

- Character Card
- World Book / Lorebook
- Prompt
- Context
- LLM Connection
- AI Generation
- 既有扩展能力

而你的框架负责：

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

---

# 29. Option Schema V1

目前建议一个选项至少具备以下结构：

```json
{
  "id": "option_001",

  "presentation": {
    "text": "这次你自己试试看，我相信你。",
    "tone": "supportive"
  },

  "behavior": {
    "actions": [
      "support",
      "respect",
      "encourage_independence"
    ],

    "intent": [
      "care",
      "encouragement"
    ],

    "risk": 0.15
  },

  "gameplay": {
    "progress": 2
  },

  "effects": {
    "affection": {
      "base": 2
    },
    "trust": {
      "base": 4
    }
  },

  "conditions": {
    "trust": {
      "min": 20
    }
  },

  "generation": {
    "must_fit_character": true,
    "must_fit_context": true,
    "variation": "high"
  }
}
```

其中：

> `effects` 只代表基础倾向，不代表最终状态变化。

最终结果由 State Resolver 计算。

---

# 30. 当前核心设计结论

目前已经形成以下核心设计：

### 30.1 玩家选择的是行为，而不是单纯台词

Option 是可计算的 Behavior Object。

### 30.2 AI 不拥有最终规则控制权

AI 提出自然语言和结构化信息，游戏引擎确认最终状态。

### 30.3 同一个行为对不同角色产生不同结果

角色人格、当前心理、关系与世界环境都会参与计算。

### 30.4 状态变化会反馈到 AI

每次互动后的状态都影响下一轮 Context。

### 30.5 角色拥有自己的认知系统

记忆力、遗忘程度、记仇、执念、注意力等参数决定哪些历史信息进入 AI Context。

### 30.6 Memory 不等于 Conversation History

历史对话需要经过 Memory Formation、Decay、Retrieval 和 Context Assembly。

### 30.7 AI 输出采用双通道

自然语言给玩家看，结构化结果供游戏引擎处理。

### 30.8 游戏是一个持续反馈系统

```text
State
→ AI
→ Option
→ Player
→ State Resolver
→ Memory
→ Context
→ AI
→ ...
```

---

# 31. 下一阶段：Turn Lifecycle

在当前设计基础上，下一步需要正式确定一轮游戏的执行顺序。

候选流程：

```text
World Tick
→ Event Selection
→ Context Assembly
→ Scenario Generation
→ Option Planning
→ Option Rendering
→ Player Choice
→ Choice Resolution
→ NPC Reaction
→ Emotional Update
→ Memory Formation
→ Relationship Update
→ World Update
→ Day / Progress Check
→ Ending Check
→ Memory Consolidation
→ Next Turn
```

下一阶段应进一步解决：

- 每个阶段由哪个模块负责
- 哪些阶段调用 LLM
- 哪些阶段必须由规则引擎执行
- 哪些数据在阶段之间传递
- 哪些数据可以修改
- 结构化 JSON Schema
- Prompt 层级
- SillyTavern API / Extension 接口
- 错误恢复与非法 AI 输出处理
- 并发与异步生成问题
- Save / Load 时的状态一致性

---

# 32. 当前设计状态

本文件中的内容属于：

> **Core Gameplay / Core Technical Framework Draft v0.1**

已经基本确定的核心理念：

- 动态状态驱动
- 选项式交互
- AI 动态生成
- 状态反馈闭环
- 角色认知系统
- Memory Engine
- Context Budget
- Roguelike Run
- 不依赖传统固定剧情树
- SillyTavern 作为 AI Runtime

尚未最终冻结的内容：

- 完整 Turn Lifecycle
- Prompt Architecture
- 完整 JSON Schema
- Memory Database Schema
- State Resolver 具体算法
- Option 生成算法
- RNG 规则
- Ending 判定系统
- SillyTavern 集成方式
- Design Mode 技术架构
