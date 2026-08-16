# AIgal：事件系统过渡与补充规划

> 文档定位：基于当前 AIgal 项目事件系统的实际输出，对下一阶段“事件之间的过渡、角色自主行为、生活层补充与状态连续性”进行规划。
>
> 核心目标：**不是继续堆积事件数量，而是让已经完成的事件系统之间形成连续、可变化、可自我运行的角色生活。**

---

## 1. 当前系统状态

目前 AIgal 的核心事件闭环已经基本建立：

```text
场景
  ↓
玩家选项
  ↓
行为标签
  ↓
AI角色反应
  ↓
Relationship / State 更新
  ↓
Memory
  ↓
后续事件引用
  ↓
Ending
  ↓
Knowledge / PermanentModifier
  ↓
下一局继承
```

当前系统已经能够实现：

- 玩家行为影响 `affection / trust / conflict`
- 角色产生记忆
- 角色心理状态发生变化
- 根据关系状态触发结局
- BAD END 后写入 Knowledge
- 通过 PermanentModifier 将部分结果带入下一局
- 形成一定程度的 Run → Ending → Next Run 闭环

因此，**事件系统本身已经具备基本可运行性**。

---

## 2. 当前主要问题

当前输出暴露出的核心问题并不是“没有事件”，而是：

> **事件之间缺乏足够的中间层。**

目前体验更接近：

```text
Event 1
  ↓
Event 2
  ↓
Event 3
  ↓
Event 4
```

而理想状态应该是：

```text
Event
  ↓
状态变化
  ↓
时间 / 地点 / 环境变化
  ↓
角色心理变化
  ↓
角色未完成意图
  ↓
生活 / 微事件
  ↓
下一次事件
```

因此下一阶段重点不是继续扩大 Event 数量，而是建立：

1. **Transition Layer**
2. **World / Life Simulation Layer**
3. **Character Autonomous Layer**
4. **Narrative State Layer**

---

# 3. 总体设计目标

最终希望将当前的：

```text
Event → Event → Event
```

升级为：

```text
Life
 ↓
Event
 ↓
Consequence
 ↓
Life
 ↓
Autonomous Event
 ↓
Memory
 ↓
Event
 ↓
Consequence
 ↓
Life ...
```

也就是说：

> **事件不应该是孤立的剧情节点，而应该是角色生活中的高密度时刻。**

玩家所看到的剧情只是角色生活的一部分。

即使玩家没有主动推动剧情：

- 时间仍然流逝
- 角色仍然活动
- 角色仍然思考
- 角色仍然形成记忆
- 角色仍然产生新的意图
- 关系仍然可能发生微小变化

---

# 4. 第一阶段：Transition System

## 4.1 目标

解决：

```text
事件 A
↓
为什么突然出现事件 B？
```

让事件之间具有自然的因果关系。

---

## 4.2 Transition 的基本结构

每次事件结束后，不应直接进入下一个事件，而应经过一个轻量 Transition：

```text
Event A
  ↓
State Update
  ↓
Transition
  ├── Time
  ├── Location
  ├── Environment
  ├── Emotional Aftermath
  ├── Pending Intent
  └── Event Scheduling
  ↓
Event B
```

---

## 4.3 Transition 可以包含的内容

### 时间

例如：

```yaml
time:
  previous: "afternoon"
  current: "evening"
```

或者：

```text
Day 6 下午
↓
Day 6 傍晚
↓
Day 7 上午
```

---

### 地点

例如：

```text
Library
↓
Campus Corridor
↓
Dormitory
↓
Classroom
```

地点变化本身可以成为自然的过渡。

---

### 环境

包括：

- 天气
- 光线
- 人流
- 校园活动
- 安静 / 喧闹
- 白天 / 夜晚

这些内容不一定改变核心剧情，但可以增加世界连续性。

---

### 情绪余波

例如：

```text
Event:
玩家认真倾听角色的过去

↓
Event Consequence:

stress -2
security +3

↓
Transition:

角色在晚上回想今天的谈话
```

这里的“回想”本身就是一个过渡事件。

---

# 5. 第二阶段：Character Autonomous Event

这是下一阶段最重要的功能之一。

当前模式主要是：

```text
玩家主动寻找角色
↓
玩家选择行为
↓
角色回应
```

未来需要增加：

```text
角色产生意图
↓
角色主动寻找玩家
↓
触发事件
```

---

## 5.1 核心理念

角色不应该只是：

> 等待玩家输入的 NPC。

而应该是：

> **拥有自己的行为倾向、需求、记忆和未完成目标的角色。**

---

## 5.2 示例

玩家前一天：

```text
在图书馆陪角色讨论历史
```

产生：

```yaml
memory:
  - player_listened_to_history

pending_intent:
  - wants_to_continue_history_discussion
```

第二天，即使玩家没有前往图书馆：

```text
玩家准备离开学校

↓

角色主动出现：

“……等等。”

“昨天你说的那些话，我后来想了很久。”

“所以，我想再和你谈谈。”
```

这会让角色真正表现出：

> **“我记得昨天发生过什么，而且这件事对我产生了持续影响。”**

---

# 6. 第三阶段：Pending Intent

为了实现角色行为连续性，需要增加“未完成意图”。

---

## 6.1 为什么需要 Pending Intent

单纯 Memory 只能表达：

> “过去发生过什么。”

但无法表达：

> “角色现在还想做什么。”

因此需要：

```yaml
pending_intents:
  - want_to_continue_history_discussion
  - want_to_know_player_past
  - want_to_give_player_book
```

---

## 6.2 Pending Intent 的生命周期

```text
产生
 ↓
等待
 ↓
择机触发
 ↓
执行
 ↓
完成 / 取消 / 转化
```

例如：

```text
玩家在图书馆倾听
↓
角色产生：
“想继续向玩家讲述真实历史”
↓
Pending Intent
↓
第二天玩家再次遇见角色
↓
Intent 被触发
↓
进入新的事件
↓
Intent 完成
```

---

## 6.3 Pending Intent 不应该每轮都执行

它应该具有：

- 优先级
- 触发条件
- 最晚触发时间
- 适合地点
- 适合时间段
- 与角色状态相关的权重

例如：

```yaml
intent:
  id: continue_history
  priority: 0.7

  conditions:
    trust: ">= 10"
    previous_event: "history_discussion"

  preferred_locations:
    - library
    - classroom

  preferred_time:
    - afternoon
    - evening
```

这样可以避免角色行为过于机械。

---

# 7. 第四阶段：Micro Events / Life Events

这是填充大型事件之间“空气”的关键。

并非每一次交互都应该是完整剧情事件。

---

## 7.1 Micro Event 的定位

Micro Event 不负责推动重大剧情。

它负责：

> **让世界看起来正在运行。**

例如：

- 玩家经过食堂，角色朝玩家点头
- 玩家发现角色正在独自看书
- 角色训练结束后喝水
- 角色主动给玩家一杯茶
- 两人在走廊短暂擦肩
- 角色提到几天前的一句话
- 玩家偶然发现角色留下的书签

---

## 7.2 三层事件结构

建议将事件逐渐划分为：

### Main Event

推动重要剧情。

```text
历史真相
关系确认
重大冲突
结局
```

### Side Event

推动角色关系和支线。

```text
训练
学习
聊天
共同活动
```

### Micro Event

维持生活感。

```text
偶遇
一句话
短暂互动
环境变化
角色独处
```

最终：

```text
Main Event
   ↑
Side Event
   ↑
Micro Event
```

三者共同构成角色生活。

---

# 8. 第五阶段：Relationship Narrative State

当前系统已经有：

```text
affection
trust
conflict
stress
security
```

这些数值负责“量化”。

下一阶段需要增加：

> **叙事层面的关系状态。**

---

## 8.1 Relationship Phase

例如：

```yaml
relationship_phase:
  current: "熟悉"
```

可以逐渐发展：

```text
陌生
 ↓
认识
 ↓
熟悉
 ↓
信任
 ↓
依赖
 ↓
亲密
 ↓
冲突
 ↓
疏远
 ↓
修复
```

这不是简单的数值阈值，而是角色关系的叙事解释。

---

## 8.2 Impression

角色应该形成对玩家的动态印象：

```yaml
impression:
  - "愿意倾听"
  - "有些冒失"
  - "似乎真的理解我"
```

这些印象可以随着玩家行为变化。

例如：

```text
玩家多次打断角色
↓
“有些不耐心”

玩家多次倾听
↓
“值得倾诉”
```

---

## 8.3 Current Desire

角色当前想要什么：

```yaml
current_desire:
  - "想继续讨论历史"
  - "想了解玩家的过去"
```

这直接服务于 Autonomous Event。

---

## 8.4 Unresolved Issues

角色还没有解决的问题：

```yaml
unresolved:
  - "为什么玩家一直关注自己"
  - "玩家究竟怎么看待自己的过去"
```

这些问题可以在未来事件中逐渐解决。

---

## 8.5 Emotional Direction

除了当前数值，还记录趋势：

```yaml
emotional_direction:
  previous: "谨慎"
  current: "依赖增加"
```

重点不是保存“角色现在是多少”，而是保存：

> **角色正在变成什么样。**

---

# 9. Event Scheduling System

当 Transition、Micro Event、Autonomous Event 和 Main Event 都存在后，需要一个统一调度器。

---

## 9.1 基本结构

```text
World State
      ↓
Character State
      ↓
Relationship State
      ↓
Memory
      ↓
Pending Intent
      ↓
Event Pool
      ↓
Eligibility Filter
      ↓
Weight Calculation
      ↓
Event Selection
      ↓
Event Generation
```

---

## 9.2 Event Pool

例如：

```yaml
events:
  library:
    weight: 10

  food:
    weight: 8

  rooftop:
    weight: 6

  character_autonomous:
    weight: 12

  micro_event:
    weight: 20

  main_story:
    weight: dynamic
```

---

## 9.3 动态权重

权重应该受到：

```text
trust
affection
conflict
stress
security
memory
relationship_phase
pending_intent
recent_events
time
location
```

共同影响。

例如：

```text
trust 高
+
角色存在未完成倾诉意图
+
当前地点 = 图书馆
+
时间 = 傍晚

↓

Autonomous History Event 权重显著提高
```

---

# 10. 当前 BAD END 系统可以作为参考模板

当前 BAD END 已经形成了一个完整闭环：

```text
玩家持续挑衅
↓
conflict 持续增加
↓
conflict >= 20
↓
BAD END
↓
Ending Archive
↓
Knowledge
↓
PermanentModifier
↓
下一局继承
```

这部分不需要推翻。

相反，可以把这种设计扩展到正常剧情：

```text
玩家行为
↓
State Change
↓
Narrative Consequence
↓
Character Memory
↓
Pending Intent
↓
Autonomous Event
↓
Relationship Phase
↓
新的行为倾向
```

这样 BAD END 不再是唯一拥有“因果链”的系统。

正常路线也拥有完整的因果链。

---

# 11. 最终目标：从 Event Engine 变成 Life Engine

当前：

```text
AIgal Event Engine
```

已经基本成立。

下一阶段目标不是简单增加更多事件，而是逐步形成：

```text
                    AIgal Life Engine

                         World
                          │
            ┌─────────────┼─────────────┐
            ↓             ↓             ↓
          Time         Location      Environment
            │             │             │
            └─────────────┼─────────────┘
                          ↓
                   Character State
                          │
          ┌───────────────┼────────────────┐
          ↓               ↓                ↓
       Memory          Desire          Relationship
          │               │                │
          └───────────────┼────────────────┘
                          ↓
                    Pending Intent
                          ↓
                   Event Scheduler
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
    Main Event        Side Event        Micro Event
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ↓
                     Player Choice
                          ↓
                    AI Response
                          ↓
                    State Update
                          ↓
                    Memory Update
                          ↓
                  Narrative Consequence
                          │
                          └──────────→ 下一轮
```

---

# 12. 实现优先级

建议不要一次性全部实现。

## P0：Transition System

首先解决：

- 时间推进
- 地点变化
- 事件余波
- 基础环境
- 下一事件的上下文传递

**目标：消除“事件硬切”。**

---

## P1：Pending Intent

增加：

- 角色当前意图
- 未完成目标
- 触发条件
- 意图完成机制

**目标：让昨天发生的事情能够影响明天。**

---

## P2：Autonomous Event

增加：

- 角色主动寻找玩家
- 角色主动发起话题
- 角色根据 Memory 做出行为

**目标：让角色不再只是被动 NPC。**

---

## P3：Micro Event

增加：

- 偶遇
- 短交互
- 环境事件
- 角色独处
- 日常行为

**目标：填充大事件之间的生活感。**

---

## P4：Relationship Narrative State

增加：

- relationship_phase
- impression
- current_desire
- unresolved
- emotional_direction

**目标：让数值变化逐渐转化为人格和关系变化。**

---

## P5：Event Scheduler

统一管理：

- Main Event
- Side Event
- Micro Event
- Autonomous Event
- Transition Event

并根据：

```text
World + Character + Memory + Relationship + Intent
```

进行动态调度。

**目标：最终形成真正的动态事件系统。**

---

# 13. 最终验收标准

下一阶段完成后，希望 AIgal 不再出现明显的：

```text
事件 A
↓
万能场景模板
↓
事件 B
```

而能够出现：

```text
昨天发生了一件事
↓
角色产生心理变化
↓
角色形成新的意图
↓
第二天角色仍然记得
↓
角色可能主动采取行动
↓
玩家可以响应
↓
关系继续变化
↓
产生新的记忆
↓
未来事件再次引用
```

最终达到：

> **玩家不是在“触发事件”，而是在“与一个会持续生活和变化的角色共同经历时间”。**

---

# 14. 核心设计原则

### 原则一：不要为了填充而填充

过渡内容的意义不是增加文本量，而是建立因果连续性。

### 原则二：Memory ≠ Intent

Memory 表示：

> “过去发生过什么。”

Intent 表示：

> “角色现在还想做什么。”

两者必须分离。

### 原则三：数值 ≠ 人格

`affection = 40` 本身没有叙事意义。

真正重要的是：

> “角色因为这些经历，开始越来越愿意向玩家倾诉。”

### 原则四：玩家不是唯一行动者

角色必须拥有一定程度的自主行为。

### 原则五：不是所有事件都需要玩家选择

生活应该包含：

- 主事件
- 小事件
- 自动事件
- 过渡
- 环境变化

### 原则六：事件应该产生后果

一个好的事件不是：

```text
Event → End
```

而是：

```text
Event
 ↓
Memory
 ↓
State
 ↓
Intent
 ↓
Future Behavior
```

---

# 15. 最终方向

AIgal 的核心竞争力不应该只是：

> **“AI 可以生成 GALGAME 剧情。”**

而应该逐渐变成：

> **“AI 角色拥有持续的记忆、状态、意图和关系变化；玩家的每一次交流都会改变角色，而角色也会反过来改变后续的交互。”**

因此：

**Event System 是基础设施。**

**Transition System 是连接。**

**Memory 是过去。**

**Intent 是未来。**

**Character State 是现在。**

而最终要构成的是：

> **一个能够在玩家参与下持续演化的 AI Character Life System。**
