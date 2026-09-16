# AI GALGAME Framework (tavern-gal)

一个以 **SillyTavern** 为可选 AI Runtime、以 GALGAME 式选择交互为表现形式、以 **Game State** 为核心、由 **AI 动态叙事 + Roguelike 机制**驱动的 AI 叙事游戏框架。

> 固定规则，而不是固定剧情；玩家选择的是行为，而不是台词；AI 负责表现，规则引擎负责真实状态。

## 文档

- **`AI_GALGAME_Master_Design_v1.0.md`** — 唯一权威设计基线（**文件名保留 v1.0，内容版本 v1.6**；§11 Life Engine、§11.11 Beat System + 叙事视角管辖权）
- **`DEVELOPMENT_PLAN.md`** — 主线分阶段开发计划（Phase 0.5–12，已完成）
- **`EVENT_LIFE_PLAN.md`** — Life Engine 实现计划（P0 ✅ / P0.5 ✅ / P1 ✅ / P2 ✅ / P3–P5 待做）
- **`BEAT_SYSTEM_DESIGN.md`** — Beat System 唯一实现依据：事件内连续叙事流（拍模型 / FlowController / motive 思维链机制）
- `docs/review/known-issues.md` — 已确认问题与校准记录
- `docs/review/` — 各阶段审计与真实 LLM 验收报告
- `docs/design-history/` — 早期设计文档归档

## 快速开始

```bash
# 依赖安装（monorepo：packages/* + apps/*）
pnpm install

# 构建全部包（拓扑顺序）
pnpm build

# 测试 / 类型检查 / Lint
pnpm test
pnpm typecheck
pnpm lint

# 真实 LLM 对局记录（经 LLM_* 环境变量配置 Provider，如 DeepSeek）
LLM_PROVIDER=openai-compatible \
LLM_BASE_URL=https://api.deepseek.com \
LLM_MODEL=deepseek-chat \
LLM_API_KEY=sk-xxx \
  ag-devtools live-play --turns 20 --out playthrough.md

# 无 LLM 确定性仿真与验收
ag-devtools simulate --runs 100
ag-devtools acceptance
```

## 当前进度

### 主线（Phase 0.5–12）✅

- ✅ Phase 1 — 数据契约冻结：`@ag/schemas` TS 类型 + Zod 运行时校验 + JSON Schema 同源生成
- ✅ Phase 2–4 — Pure Game Core / StateResolver（Modifier 链）/ 可复现 RNG + EventPool + WorldTick
- ✅ Phase 5–7 — Narrative / Option Engine、Memory / Context 全生命周期、LLM Gateway（OpenAI / Anthropic / OpenAI-Compatible）
- ✅ Phase 8 — SillyTavern Adapter：Character Card V2 / World Book / Context Bridge / Compiler
- ✅ Phase 9–12 — Runtime 编排 + Application API + React Player、Designer Mode、devtools 仿真调试、表现层
- ✅ Completion Plan A–H — 二次结算、PlayerModel、Bad End→Meta 跨局、LLM 软多样性、一致性检查、天气/日历/NPC 日程、Policy 运行时

### Life Engine（事件 → 生活流）🔄

- ✅ **2026-08-21 审计接线修复**：ContextCache、检索强化、记忆修剪、一致性规则、重试配置接入生产路径
- ✅ **P0 Transition System**：选项节点之间的过渡文段（旁白+对话）、日内时间流动、Memory 联动三件套（检索供素材→引用即强化→回想产新忆）、合并调用保持 2 次/Turn
- ✅ **P0.5 Beat System**：事件内连续叙事流——选择 → 文段拍 → 选择点交替；FlowController 裁决节奏（预算/间隔/分支价值）；事件重要性权重（main/side/micro 决定拍数预算与数值放大）；双推进模式（▼ 手动 / 自动连播，到选项必停）；motive 思维链→扮演对象回流驱动叙事
- ✅ **P1 Pending Intent**：角色未完成意图——事件末次 motive 思维链确定性转化为意图，同地点/时间段/条件匹配时择机触发为意图事件并完成，超时过期（Intent ≠ Memory：昨天的事影响明天）
- ✅ **P2 Autonomous Event**：角色主动寻找玩家——意图紧迫（截止日/高优先级跨日）且玩家未到场时，角色主动发起事件（origin=autonomous），开场叙事从她主动出现切入并自然提及过去（"……找到你了。昨天你说的那些，我后来想了很久。"）
- ✅ **双 Agent 视角管辖权（v1.6，2026-09-16）**：PlayerAgent（玩家第一人称「我」叙事+选项）/ CharacterAgent（文段拍+反应+过渡，角色内心只进 motive）门面（`packages/narrative/src/agents/`）；真实 LLM 复验四项 POV 指标全过；#16 遗留观察（台词级去重 + 反应场景 grounding）已修复——12/12 轮反应场景连贯、台词重复 0
- ⏭️ **P3 Micro Events**（S1–S5 实施计划已定）→ P4 Relationship Narrative State → P5 Event Scheduler

### 已验证能力（真实 DeepSeek 长对话）

- 场景/选项/反应 llm 占比 ≥90%（V4 Flash 复验：文段拍 100% / 选择拍 95% / 反应 100%）
- "角色真的记得你"：记忆形成→检索注入→言行呼应全链路成立
- 拍间复写已校准消除（相邻拍相似度 0.072）；known-issues #15 全部关闭（2026-09-10：stress 不归零、节奏变奏、fallback 清零）；跨局 Meta 继承闭环可自动化验收
- 推理模型（如 DeepSeek V4 Flash）需设置 `LLM_THINKING=disabled`：关闭思维链后 temperature 生效、响应速度快、structured JSON 输出稳定

## 仓库结构

```text
packages/        @ag/* 库（schemas → core → world/memory/context/narrative → runtime → adapters）
apps/            player 玩家 UI / designer 设计器 / devtools 模拟·调试·真实对局记录
projects/ saves/ 示例 Project 与运行时存档
docs/            review 审计与验收报告 / design-history 归档
```
