# AI GALGAME Framework — 项目构思与 Game State Design

> 版本：v0.1 Draft
>
> 状态：核心玩法与状态系统设计阶段，暂未进入实现阶段
>
> 说明：本文档记录当前讨论得到的项目构思、核心设计理念与 Game State Design。后续技术选型、Prompt 体系、Option Schema、Memory System、Context Builder、SillyTavern 接口等内容将在此基础上继续设计。

---

# Part I. 项目构思与设计理念

## 1. 项目定位

本项目的目标不是简单地“给 SillyTavern 加一个 GALGAME UI”，而是构建一个：

> **以 SillyTavern 为 AI / Character Runtime，以传统 GALGAME 为交互形式，以 Roguelike / Roguelite 为重复游玩机制，以动态状态与角色认知系统为核心的 AI Narrative Game Framework。**

项目同时具备两种使用身份：

- **Play Mode：** 玩家进行游戏、与 AI 角色互动、作出选择、观察关系与世界状态变化并完成 Run。
- **Design Mode：** 创作者创建角色、配置世界、参数、规则和 Prompt，并自动生成对应的 SillyTavern Character Card / World Book 等运行资源。

核心目标是让玩家感受到：

> 作者设计的是“世界与规则”，AI 在规则允许的空间里生成具体事件、对话与选项；玩家的每一次选择会改变状态，而新的状态又会反过来影响下一轮 AI 生成。

---

## 2. 核心设计宣言

项目的核心循环可以概括为：

> **规则 → AI → 选项 → 玩家选择 → 状态变化 → AI → 选项 → ……**

更完整地说：

> **玩家通过离散的行为选项与 AI 角色持续互动；每一次互动都会改变关系、人格、世界、时间与认知状态，而这些状态又反过来决定 AI 下一次能够生成什么，从而形成一个没有固定剧本、但受到世界规则约束的动态叙事循环。**

Roguelike / Roguelite 机制进一步加入：

> **失败不是简单的结束，而是下一次攻略的情报。**

Bad End 可以产生惩罚、记忆、知识、解锁或其他 Meta Progression，使失败成为下一次 Run 的一部分。

---

## 3. 与传统 GALGAME 的区别

传统 GALGAME 大体是：

```text
作者
 ↓
固定剧情树
 ↓
玩家选择
 ↓
少量分支
 ↓
固定结局
```

本项目希望采用：

```text
作者
 ↓
世界规则 + 角色规则 + 参数规则
 ↓
AI 动态生成事件
 ↓
AI 动态生成选项
 ↓
玩家选择
 ↓
状态变化
 ↓
AI 根据新状态生成下一轮内容
 ↓
持续循环
```

因此项目更接近：

> **Narrative Sandbox / Dynamic Narrative Simulation**

而不是完全固定剧本的传统 Visual Novel。

---

## 4. SillyTavern 的定位

SillyTavern 不作为整个游戏引擎，而作为：

> **AI Runtime / Character Runtime**

主要复用其已有能力：

- Character Card
- World Book / Lorebook
- Prompt / Context 管理
- LLM API 接入
- AI 对话生成
- Memory 相关能力
- TTS、图片、Live2D 等未来扩展能力

本项目自己的核心层负责：

- 游戏状态
- 选项系统
- 参数系统
- 时间 / Day 系统
- 随机世界
- Run 系统
- Ending / Bad End
- Punishment / Meta Progression
- 存档
- Design Mode
- Character Creator
- Export

推荐关系：

```text
┌───────────────────────────────┐
│       AI GALGAME Framework    │
│                               │
│  Game Logic / State / Design  │
│              │                │
│              ▼                │
│       SillyTavern Runtime     │
│              │                │
│              ▼                │
│             LLM               │
└───────────────────────────────┘
```

---

## 5. 第一阶段开发原则：先文本，后表现

第一版暂不追求完整视觉表现，而是优先实现：

- 纯文本剧情
- 选项式交互
- 参数变化
- AI 动态生成
- 世界状态
- 角色状态
- Memory / Cognition 基础系统
- Run / Ending
- 存档
- 设计器
- 文本导出

后续再逐步加入：

```text
文本
 ↓
GAL UI
 ↓
角色立绘
 ↓
背景
 ↓
CG
 ↓
语音 / TTS
 ↓
Live2D / 动画
```

这样可以先验证“游戏是否好玩”，而不是先验证“UI 是否漂亮”。

---

## 6. 核心交互：取消自由输入，改为选项驱动

玩家的主要交互方式不是直接向角色输入任意自然语言，而是：

```text
AI 生成当前情境
 ↓
AI 生成 3~4 个选项
 ↓
玩家选择一个行为
 ↓
游戏引擎结算
 ↓
AI 生成结果与下一情境
```

因此：

> **玩家不是在选择台词，而是在选择行为。**

例如：

```text
A. 坐到她旁边，什么也不说
B. 主动询问她是不是遇到了什么事情
C. 开玩笑缓和气氛
D. 留给她一个人安静看书
```

这些选项底层可以分别带有行为标签：

```text
A: quiet_presence
B: concern
C: humor
D: respect_for_space
```

玩家看到的是自然语言；游戏引擎处理的是结构化行为。

---

## 7. AI 与游戏引擎的职责边界

这是项目最重要的架构原则之一。

### AI 可以负责

- 当前情境生成
- 世界事件生成
- NPC / 角色对话
- 选项自然语言生成
- 角色心理表达
- 根据状态决定“可能发生什么”
- 根据角色设定生成符合人格的内容
- 根据已有规则提出候选行为或事件

### AI 不直接掌控

- 好感度最终数值
- 信任度最终数值
- 行动点 / Daily Progress
- Day 是否切换
- FLAG 最终值
- 存档
- Ending 最终判定
- 合法数值范围
- 规则冲突的最终解决

推荐原则：

> **AI 负责“提出和演绎”；游戏引擎负责“验证和结算”。**

---

## 8. 基本游戏循环

```text
开始新 Run
    ↓
初始化世界状态 / 角色状态
    ↓
Day 1
    ↓
AI 根据状态生成当前情境
    ↓
AI 生成选项
    ↓
玩家选择
    ↓
State Resolver 结算
    ↓
角色 / 关系 / 世界 / 时间 / 记忆更新
    ↓
Daily Progress 是否达到上限？
    ├── 否 → 继续下一轮
    └── 是 → 进入下一天
    ↓
持续循环
    ↓
Ending 判定
    ├── Good End
    ├── Normal End
    └── Bad End
    ↓
Punishment / Meta Progression
    ↓
New Run
```

---

## 9. Day / Daily Progress 机制

第一版将“行动点”更适合定义为：

> **Daily Progress（日程进度）**

示例：

```text
Day 8
Daily Progress
██████░░░░ 6 / 10
```

不同类型行为可以产生不同进度变化：

| 行为类型 | Progress 示例 |
|---|---:|
| 普通聊天 | +1 |
| 陪伴 | +2 |
| 认真帮助 | +3 |
| 冲突 | +1 |
| 重大事件 | +4 |
| 特殊活动 | +5 |
| 独处 / 休息 | +0 |

达到每日上限后进入第二天。

### 重要原则

不是所有行为都必须积极推进，也允许玩家：

- 浪费一天
- 独处
- 暂时不接近角色
- 采取消极行为
- 主动制造风险

因此 Progress 更像“生活时间的消耗 / 推进”，而不是传统 RPG 的能量值。

---

## 10. 选项的设计思想

选项不是随机生成的普通文本，而是：

> **具有设计参数的结构化行为对象。**

例如：

```json
{
  "id": "choice_001",
  "text": "这次你自己试试看，我相信你。",
  "behavior": [
    "support",
    "respect",
    "encourage_independence"
  ],
  "progress": 2,
  "risk": 0.15,
  "effects": {
    "affection": { "base": 2 },
    "trust": { "base": 4 }
  }
}
```

AI 的主要工作是把“行为模板”表达成符合当前情境、角色与世界状态的自然语言。

---

## 11. 动态好感度与关系系统

第一版不采用简单的：

```text
affection += 5
```

而是逐步建立动态模型：

\[
\Delta S = f(A, P, C, R, W)
\]

其中：

- `A`：玩家行为
- `P`：角色人格
- `C`：角色当前状态
- `R`：双方当前关系
- `W`：世界环境

即同一个行为，对不同角色可能产生完全不同的结果。

关系状态建议至少包括：

- Affection：好感
- Trust：信任
- Intimacy：亲密
- Familiarity：熟悉程度

并另外维护：

- Relationship Type：关系类型

例如：

```text
stranger
acquaintance
friend
close_friend
romantic_interest
partner
conflicted
estranged
```

“好感高”不等于“恋爱关系”，例如：

```text
Affection = 80
Trust = 20
```

可能表示：

> 我很喜欢你，但我不相信你。

---

## 12. 角色参数 / 心理动力学

角色不仅拥有传统意义上的“好感”，还拥有自己的心理状态。

第一阶段建议包括：

- Confidence：自信
- Independence：独立性
- Dependence：依赖
- Stress：压力
- Loneliness：孤独
- Jealousy：嫉妒

以及瞬时状态：

- Mood：当前心情
- Energy：当前精力

角色参数会动态改变，并反过来影响 AI 的行为生成。

例如：

```text
independence = 85
confidence = 30
trust = 60
```

玩家如果长期选择“鼓励她自己解决问题”的行为，可能得到：

```text
Trust +4
Affection +2
Confidence +3
Independence +2
```

如果角色具有高度依赖性，则相同的行为可能造成不同结果。

---

## 13. 世界状态与随机世界

不设置大量固定强制剧情，而是构建一个有规则的随机世界。

世界可以包括：

- 地点
- 时间
- 天气
- 季节
- 星期
- 公共事件
- Active Event
- World Flag

例如：

```text
Day 4
Weather = Rain
Location = School
Heroine Mood = Anxious
Random Event = Power Outage
```

AI 根据这些条件生成事件与选项。

### 关键原则

不是“完全随机世界”，而是：

> **在固定的世界规则与可用空间里随机采样事件。**

例如图书馆可以偏向：

- 阅读
- 学习
- 安静聊天
- 偶遇
- 雨天事件

天台可以偏向：

- 独处
- 深度谈话
- 特殊关系事件
- 冲突

---

## 14. Bad End / Punishment / Meta Progression

Bad End 不应只是：

```text
选错 → Game Over
```

而应该是完整的失败叙事。

Bad End 可以包括：

- 关系破裂
- 无法建立关系
- 过度依赖
- 信任崩溃
- 角色走向错误人格
- 其他特殊失败状态

Bad End 后进入 Punishment / Meta Progression：

```text
Bad End
 ↓
Punishment
 ↓
Debuff / Memory / Knowledge / Unlock
 ↓
New Run
```

例如：

> 第一次失败后获得“她害怕被忽视”的知识。

下一局玩家拥有更高的信息量，从而可以改变策略。

### 设计理念

> **失败不是结束，而是下一次攻略的情报。**

---

## 15. Run 机制

一局游戏定义为一个 Run：

```text
Run #001
Day 1
 ↓
Day 2
 ↓
...
 ↓
Ending
```

每次 Run 可以拥有独立的：

- Random Seed
- World State
- Character State
- Relationship State
- Event History

而部分 Meta State 跨 Run 保留：

- Knowledge
- Memories
- Unlocks
- Achievements

这样形成 Roguelite 结构。

---

## 16. 角色创建器与迁移模板

设计 Mode 中应该提供成熟的 Character Template。

角色至少可以定义：

### Identity

- Name
- Age
- Gender
- Gender Identity
- Sexual Orientation
- Role / Occupation

### Personality

- Traits
- Values
- Fears
- Habits
- Speech Pattern

### Preferences

- Likes
- Dislikes
- Interests

### Relationship

- Initial Affection
- Initial Trust
- Initial Intimacy
- Initial Relationship

### Psychological Parameters

- Independence
- Dependence
- Confidence
- Jealousy
- etc.

### Cognition

- Memory Capacity
- Forgetfulness
- Retention
- Retrieval
- Grudge
- Obsession
- Attention

### Hidden Information

- Secrets
- Goals
- Past
- Trauma / Sensitive Backstory（按项目内容规则配置）

### AI Constraints

- Speech Rules
- Behavior Rules
- Boundaries
- Prompt Instructions

最终一键生成：

```text
Character Card
+
World Book / Lorebook
+
Game State Definition
+
Relationship Rules
+
AI Prompt
```

---

## 17. Play Mode 与 Design Mode

### Play Mode

玩家看到：

```text
Day 4     16:30
School / Library

【角色】
“今天……你要一起回去吗？”

[A] 陪她一起回家
[B] 说自己还有事情
[C] 反问她为什么突然邀请我
[D] 开个玩笑

Daily Progress
██████░░░░ 6 / 10

Relationship
♥♥♥♥♥♥♥○○○
```

输入框在核心玩法中不再是主要交互形式。

### Design Mode

```text
Project
├── Characters
├── World
├── Parameters
├── Option Templates
├── Ending Rules
├── Prompt Rules
└── Export
```

设计者能够：

> 创建角色 → 生成酒馆资源 → 配置世界 → 测试 Run → 发布 / 导出

---

## 18. 存档与文本导出

存档从第一版就应视为核心系统，而不是后补功能。

建议保存：

```json
{
  "run_id": 17,
  "day": 8,
  "daily_progress": 6,
  "world_state": {},
  "characters": {},
  "relationships": {},
  "parameters": {},
  "flags": {},
  "memories": [],
  "knowledge": [],
  "choices": [],
  "random_seed": 382917,
  "run_status": "active"
}
```

必须记录 `random_seed`，以支持 Run 重现与开发调试。

文本导出建议支持：

- Markdown
- TXT
- JSON

导出的内容可以完整记录：

- Day
- Event
- Choice
- AI Response
- State Change
- Ending

这样一局 Run 本身也可以成为一篇独立的动态视觉小说文本。

---

## 19. R18 与 LGBTQ 内容层

项目可以从架构上支持成熟向内容与复杂关系模型，同时保持内容层与核心状态机解耦。

LGBTQ / 性别与取向不应作为特殊模式，而应该是 Character Schema 的普通字段：

```text
Gender
Gender Identity
Sexual Orientation
Relationship Type
```

关系系统统一处理不同类型的人际 / 恋爱关系。

对于成人向内容，应采用独立的 Content Layer / Rating 配置，不改变核心 Game State 架构。

项目设计不应以“绕过安全限制”为目标，而应将内容边界、年龄评级、角色年龄与自愿关系等作为正式的项目规则进行管理。

---

# Part II. Game State Design

## 20. Game State 总体结构

Game State 当前规划分为五个层级：

```text
GAME STATE
│
├── ① RUN STATE
├── ② WORLD STATE
├── ③ CHARACTER STATE
├── ④ RELATIONSHIP STATE
└── ⑤ META STATE
```

此外，Memory / Cognition 作为 Character State 与 AI Context Builder 之间的重要子系统。

---

## 21. Run State

Run State 描述“一局游戏现在进行到哪里”。

核心字段：

```text
run_id
Day
time
daily_progress
current_location
current_event
random_seed
run_status
```

示例：

```json
{
  "run_id": 17,
  "day": 8,
  "time": "16:40",
  "daily_progress": 6,
  "current_location": "library",
  "random_seed": 382917,
  "run_status": "active"
}
```

---

## 22. World State

World State 描述当前世界发生什么：

```text
weather
season
weekday
location
time_of_day
public_events
active_events
world_flags
```

未来可以继续扩展：

- NPC 分布
- 社会事件
- 校园状态
- 设施开放状态
- 资源状态
- 世界级长期事件

---

## 23. Character State

角色状态进一步分成：

```text
Character State
│
├── Personality
├── Psychological State
├── Physical State
├── Current Emotion
└── Cognition
```

### Personality

偏长期、变化较慢：

```text
independence
confidence
sociability
sensitivity
assertiveness
```

### Psychological State

长期会被玩家行为改变：

```text
confidence
dependence
stress
security
loneliness
jealousy
```

### Current / Short-Term State

```text
mood
energy
stress
embarrassment
current_intent
```

其中 `Mood / Energy` 是影响当前 AI 表现的重要即时状态。

---

## 24. Relationship State

关系系统第一版建议采用：

```text
affection
trust
intimacy
familiarity
relationship_type
```

关系数值不直接等价于结局，而是共同决定角色的行为倾向。

例如：

```text
Affection = 80
Trust = 20
```

意味着高喜欢、低信任；并不等价于稳定恋爱关系。

---

## 25. Cognition / Memory State

这是后续系统区别于普通 AI GAL 的关键设计。

角色拥有一个自己的“认知系统”，用于决定：

- 记住什么
- 记多久
- 什么时候想起来
- 什么事情容易被反复想起
- 当前能处理多少历史信息
- 哪些过去事件会影响当前行为

建议分为：

```text
Cognition
├── Memory Capacity
├── Encoding
├── Retention
├── Retrieval
├── Forgetfulness
├── Grudge
├── Obsession
└── Attention
```

---

## 26. 记忆不是单纯的文本列表

每条 Memory 应保存结构化信息，例如：

```json
{
  "memory_id": "mem_034",
  "content": "玩家曾经在雨天等了她两个小时",
  "created_at": {
    "day": 3,
    "time": "18:30"
  },
  "type": "episodic",
  "importance": 0.82,
  "emotional_intensity": 0.91,
  "valence": "positive",
  "related_characters": ["heroine"],
  "tags": ["support", "promise", "rain"],
  "strength": 0.76,
  "last_recalled": 2
}
```

未来可支持不同记忆类型：

- Episodic：事件记忆
- Semantic：事实知识
- Emotional：情绪关联记忆
- Social：关于他人的社会记忆

---

## 27. Encoding / Retention / Retrieval 三阶段记忆模型

### Encoding：记住什么

一件事情发生后，是否进入记忆系统取决于：

- 事件重要性
- 情绪强度
- 注意力
- 角色人格
- 当前状态

### Retention：能记多久

记忆强度随时间衰减。

基础模型可以使用：

\[
S(t)=S_0e^{-\lambda t}
\]

其中：

- `S0`：初始记忆强度
- `t`：经过的时间
- `λ`：遗忘速度

`λ` 可以受到：

- Forgetfulness
- Memory Retention
- Emotional Sensitivity
- Grudge
- Obsession

等参数影响。

### Retrieval：什么时候想起来

角色可以记得某件事，但并不代表当前会主动想到。

例如几个月前玩家送过一本书，角色可能依然保留记忆，但只有在相关话题、地点、情绪或关系情境下才被检索出来。

---

## 28. 记忆强化（Memory Reinforcement）

记忆被重新回忆后，不应永远保持原始衰减状态。

例如：

```text
Day 1: Memory Strength = 0.80
Day 10: Memory Strength = 0.42
```

若玩家再次触发相关话题，角色成功检索该记忆，则可以：

```text
0.42 → 0.68
```

这模拟“反复回忆会增强记忆”的过程。

---

## 29. 记忆力 ≠ 记仇

这两个参数必须分开。

一个角色可以：

```text
Memory Retention = 高
Grudge = 低
```

表示：

> 什么都记得，但不会长期怨恨。

也可以：

```text
Memory Retention = 低
Grudge = 高
```

表示：

> 记不清所有细节，但对某次伤害长期无法释怀。

因此一次负面事件形成的记忆强度可以与：

```text
importance
× emotional_intensity
× grudge_modifier
× personality_modifier
```

有关。

---

## 30. Obsession / Fixation

`Obsession` 不等于“记忆更好”，而是：

> **某些记忆更容易持续占据角色注意力。**

例如：

```text
Obsession = 95
```

即使某段记忆本身已经不是特别强，它仍然可能频繁被检索。

由此可以产生：

```text
高记忆 + 低执念
→ 记得，但不太在意

低记忆 + 高执念
→ 记不清细节，但无法释怀

高记忆 + 高执念
→ 记得非常清楚，并经常重新想起

低记忆 + 低执念
→ 容易自然淡忘
```

---

## 31. Cognitive Context Budget

“角色记忆力决定模型上下文长度”这一概念在工程上不直接等价于改变 LLM 的真实 Context Window。

更合理的实现方式是：

> **用角色认知能力控制 Context Builder 每次允许从历史中检索多少、哪些内容，以及每条内容拥有多大优先级。**

例如角色拥有：

```text
Cognitive Capacity = 100
```

Context Builder 可以分配：

```text
Recent Events       30
Relevant Memories   40
Personality         20
Current Emotion     10
```

不同角色拥有不同的 Cognitive Capacity、Retrieval 与 Retention。

### 角色 A：记忆强

```text
Cognitive Capacity = 100
Retrieval = 90
Retention = 90
```

### 角色 B：健忘

```text
Cognitive Capacity = 50
Retrieval = 40
Retention = 30
```

### 角色 C：执念型

```text
Cognitive Capacity = 70
Retrieval = 60
Obsession = 95
```

角色 C 不一定记得更多，但特定记忆更容易被重新检索。

---

## 32. Attention 对上下文的动态影响

角色不是在任何时候都以相同认知能力处理信息。

当前 Attention 可以受到：

- Mood
- Stress
- Energy
- Location
- Current Event
- 当前对话内容

影响。

例如：

```text
Stress = 90
```

可能导致：

- Context Budget 实际可用量下降
- 检索到的历史记忆减少
- 角色对复杂信息的处理能力下降
- 当前对话更容易偏向当下情绪

这可以形成：

> “她明明知道这件事情，但今天状态太差，没有立刻想起来。”

---

## 33. Context Builder

LLM 不应该读取整个历史，而应该通过认知系统获得当前需要的信息：

```text
Raw Conversation History
        ↓
Event Extraction
        ↓
Memory Formation
        ↓
Memory Decay
        ↓
Memory Retrieval
        ↓
Context Builder
        ↓
LLM
```

当前 Context 可以由：

```text
CURRENT WORLD STATE
+
CURRENT CHARACTER STATE
+
RELATIONSHIP STATE
+
RECENT EVENTS
+
RETRIEVED MEMORIES
+
PERSONALITY / RULES
+
META INFORMATION
```

组成。

这样即使玩家运行 100 天、产生上千次互动，也不需要把全部原始对话一直塞进模型上下文。

---

## 34. Future Direction：错误记忆

后续版本可以考虑加入“记忆不完全可靠”的机制。

例如：

```text
Original Event:
玩家送她回家
```

长期之后角色记忆可能变成：

```text
“那天下雨了，你陪我走了很久。”
```

即使真实事件并没有下雨。

可为每条记忆加入：

```text
accuracy
```

让角色以“自己的记忆版本”理解过去，而不是始终调用绝对真实的历史日志。

**注意：此功能属于后期设计，不建议进入第一版。**

---

## 35. Behavior → State Resolver

选项不能直接绑定固定数值，而应该首先绑定行为标签。

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

然后根据角色人格、关系、状态、世界环境等计算最终变化。

例如：

```text
support
    → Trust ↑

respect
    → Affection ↑ / Trust ↑

encourage_independence
    → Independence ↑
```

但对于不同角色，倍率与方向可以不同。

因此：

> **行为决定“做了什么”；角色系统决定“这个行为意味着什么”。**

---

## 36. Risk System

选项还可以携带风险参数。

例如：

```text
Choice A → Low Risk
Choice B → Medium Risk
Choice C → High Risk
```

风险代表：

> 结果的不确定性，而不等于“坏”。

高风险行为可能出现：

```text
成功 → Affection +10
失败 → Trust -15
```

这样可以形成 Roguelike 式的风险收益决策。

---

## 37. 当前 Game State 总蓝图

```text
GAME STATE
│
├── RUN
│   ├── Day
│   ├── Time
│   ├── Daily Progress
│   ├── Location
│   └── RNG Seed
│
├── WORLD
│   ├── Weather
│   ├── Season
│   ├── Weekday
│   ├── Events
│   ├── Active Events
│   └── World Flags
│
├── CHARACTERS
│   ├── Personality
│   ├── Psychological State
│   ├── Physical State
│   ├── Mood
│   ├── Energy
│   └── Cognition
│       ├── Memory Capacity
│       ├── Encoding
│       ├── Retention
│       ├── Retrieval
│       ├── Forgetfulness
│       ├── Grudge
│       ├── Obsession
│       └── Attention
│
├── RELATIONSHIPS
│   ├── Affection
│   ├── Trust
│   ├── Intimacy
│   ├── Familiarity
│   └── Relationship Type
│
├── MEMORY
│   ├── Episodic
│   ├── Semantic
│   ├── Emotional
│   └── Social
│
├── FLAGS
│
├── META
│   ├── Knowledge
│   ├── Memories
│   ├── Unlocks
│   └── Achievements
│
└── ENDGAME
    ├── Good End
    ├── Normal End
    ├── Bad End
    └── Punishment
```

---

# Part III. 当前设计共识与待设计内容

## 38. 已经基本确定的设计共识

1. 基于 SillyTavern 的 Character Card / World Book / AI Runtime。
2. 游戏主要采用 GALGAME 式离散选项，而不是开放输入。
3. AI 动态生成情境与选项，但选项受到规则约束。
4. 玩家选择改变关系、角色心理、世界与时间状态。
5. 状态会反过来影响 AI 下一轮生成。
6. 不以大量固定强制剧情为主，而采用随机世界 + 状态驱动事件。
7. 采用 Day / Daily Progress 系统。
8. 具有 Good / Normal / Bad End。
9. Bad End 可以产生 Punishment / Knowledge / Memory / Unlock 等 Meta Progression。
10. 每次 Run 有独立状态，并通过 RNG Seed 支持复现。
11. 角色拥有长期人格、心理状态、短期情绪与认知系统。
12. 角色 Memory 具有 Encoding / Retention / Retrieval 等过程。
13. Memory、Grudge、Obsession、Attention 等参数会影响 AI Context Builder。
14. Game State Engine 拥有最终规则解释权，AI 不直接修改核心数值。
15. 项目同时具备 Design Mode 与 Play Mode。
16. 第一阶段优先实现纯文本版本，视觉与语音后续加入。

---

## 39. 下一步需要继续设计的内容

以下内容尚未完全冻结：

### A. Option Schema
需要正式定义一个选项的完整字段：

- 行为标签
- Progress
- Risk
- 关系影响
- 角色参数影响
- 条件
- 隐藏信息
- AI 后续生成方向
- 是否允许玩家看到部分信息

### B. Memory System
需要进一步确定：

- Memory 创建规则
- Memory 类型
- Importance 计算
- Emotional Intensity
- Decay 参数
- Retrieval Score
- Reinforcement
- Memory Conflict
- Memory Compression

### C. Context Builder
需要确定：

- Context Budget 如何计算
- 最近事件占多少
- 记忆检索如何排序
- 哪些状态强制注入
- 哪些状态只在必要时注入
- 不同角色 Cognitive Profile 如何映射到 Context

### D. World Generator
需要确定：

- 地点 Schema
- 事件 Schema
- 天气 / 时间规则
- Random Seed
- 事件生成概率
- Event Conditions
- Event Conflict Resolution

### E. Ending System
需要确定：

- Good / Normal / Bad End 判定机制
- 多变量结局
- Bad End 分类
- Punishment 规则
- Meta Progression

### F. Character Creator
需要确定：

- Character Template Schema
- Personality Schema
- Cognition Schema
- Relationship Schema
- 如何自动生成 Character Card
- 如何自动生成 World Book

### G. SillyTavern Integration
需要确定：

- Extension 结构
- API 调用方式
- State 与 ST Context 的同步方式
- 如何控制 ST 输入框 / 选项 UI
- 如何读取 / 写入 Character Card 与 World Book
- Save / Load 如何与 ST 协同

---

# 40. 当前阶段的核心判断

本项目目前已经不应简单理解为：

> “SillyTavern + GALGAME UI”

更加准确的定义是：

> **一个以 SillyTavern 为 AI Runtime、以结构化 Game State 为规则核心、以 AI 动态叙事为内容生成机制、以 Roguelike Run 与 Meta Progression 为重复游玩机制的 AI Narrative Game Framework。**

其最核心的技术 / 设计思想可以浓缩为：

> **固定世界规则，动态生成经历；固定状态边界，动态产生关系；角色拥有自己的记忆与认知，而不是每次都读取完整历史。**

最终希望实现的体验是：

> 玩家并不是在“攻略一份写好的剧本”，而是在一个由规则约束的 AI 世界里，与拥有独立人格、关系、情绪和记忆能力的角色共同经历一段不断变化的生活。
