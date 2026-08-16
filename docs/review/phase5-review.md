# Phase 5 Narrative / Option Engine —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`00c0ca1`（Phase 5 Narrative / Option Engine）
> 结论：**无阻断项，Phase 5 通过，可进入 Phase 6（Memory / Context）。**
> 以下为需在进入 Phase 6 前处理/确认的事项，按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（46 文件 / 142 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- LLM Port + TestProvider：`LLMGateway.generate(req): Promise<res>` 与设计接口一致；TestProvider 支持 fixture 序列 / 调用记录 / 抛错路径。真实 Provider 留待 Phase 7。
- 双通道输出（narrative + structured）经 Zod 严格校验；结构化解析剥离 markdown fence + JSON + Schema 校验，失败 Retry → 确定性 Fallback，**Fallback 路径有测试**。
- `runNarrativeTurn` 走 `resolveChoice`，Narrative 层不直接改 GameState（有非突变断言）——守住"AI 提出、引擎确认"。
- 多样性 4 类模板 + `validateOptions` 四类覆盖强制校验。
- **Phase 4 接线点已闭环**：`world/event-trigger.ts` `commitTriggeredEvent` 写入 `world.activeEvents` + `lastTriggeredDay` + `recordTriggered`。

---

## 🟠 待确认 / 应修（建议 Phase 6 前处理）

### 1. Option Realization 是占位，不是自然语言
- 位置：`packages/option/src/renderer.ts:11-12`；`packages/narrative/src/option-planner.ts:84`（prompt 未要求 `presentation`）
- 问题：LLM 只输出结构化规划（无 `presentation`），`renderOption` 用**行为名拼接**生成玩家文本（如 `"support / respect / encourage_independence（support）"`）。不符合设计"把行为转成自然语言"（"你是不是累了？要不要我陪你一会儿？"），违反**"玩家看到的是自然语言，引擎处理结构化行为"**与 **"Surface Language 与 Gameplay Logic 分离"**。
- 影响：玩家看到的选项是行为标签拼接，体验不符合 GALGAME 预期。
- 处理二选一：
  - **A（推荐）**：让 LLM 选项输出带 `presentation.text`（`plannedOptionSchema` 增加 `presentation` 字段），并同步更新 prompt；
  - **B**：增加独立的 Option Realization 步骤（把 `renderOption` 的占位文本替换为 LLM 生成的自然语言）。
  - 无论 A/B：`renderOption` 保留机械文本作为 fallback，仅在 LLM 缺失时使用。

### 2. NPC Reaction 未接收结算结果
- 位置：`packages/narrative/src/turn-pipeline.ts:47-53`
- 问题：`generateReaction(context, state, selectedOption, ...)` 传入的是**结算前** `state`，未把 `resolution.directDelta`（或结算后状态）注入反应。设计 Stage 10 明确"**Game Engine 先确认客观结果，AI 根据结果生成角色反应**"。
- 影响：NPC 对结算结果的反应缺失（如"帮了她→她感激"无法体现），叙事与状态脱节。
- 处理：把 `resolution`（state changes）传入 `generateReaction`，并在 reaction prompt 中带上结算摘要（如"好感 +2 / 信任 +1"）。

---

## 🟢 建议（不阻塞，择机处理）

### 3. Scenario + Options 并行 2 次 LLM 调用
- 位置：`packages/narrative/src/turn-pipeline.ts:35-38`
- 设计"LLM Call Minimization"建议二者可合并为 1 次（Turn 理想 3→2 次）。当前为 3 次调用（scenario / options / reaction）。

### 4. `maxAttempts` 语义易误导
- 位置：各生成器（`scenario-generator.ts:17` 等）`for (attempt = 0; attempt <= maxAttempts; ...)` 实际跑 N+1 次。
- 建议改名 `maxRetries`，或注释明确"最多重试 N 次"。

### 5. Retry 未区分可重试性
- `LLMError.retryable` 已定义但生成器统一 catch 重试；Phase 7 真实 Provider 落地时建议按 `retryable` + backoff 区分处理。

---

## 处理建议

- 🟠 #1、#2 改动集中在 `packages/narrative` 与 `packages/option`，均较小；处理完复跑 `pnpm --filter @ag/narrative test && pnpm --filter @ag/option test && pnpm build`。
- 🟢 均为可选项，可随 Phase 7 / 成本优化覆盖。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **Option Realization**：采纳方案 A。`plannedOptionSchema` 现要求 LLM 输出 `presentation.text/tone`（玩家可读自然语言），prompt 同步更新；`renderOption` 保留行为拼接文本作为无 LLM 时的机械 fallback。
2. **NPC Reaction 注入结算结果**：`generateReaction` 新增可选 `resolution` 参数；`runNarrativeTurn` 将 `StateResolver` 的 `directDelta` 传入，reaction prompt 携带 `rel.metric: before→after (delta)` 结算摘要。新增测试断言 prompt 包含结算结果。
3. **Scenario + Options 合并**：已作为必做项记入 `DEVELOPMENT_PLAN.md` Phase 7 任务清单（Turn 3 次 → 2 次）。
4. **maxAttempts 语义**：三个生成器的 `maxAttempts` 均补充 JSDoc，明确“最多重试 N 次，实际总调用 N+1 次”。
5. **Retry 可重试性**：生成器 catch 中现会检查 `LLMError.retryable`，不可重试错误直接进入 Fallback，不再盲目重试。

回归结果：

```text
pnpm --filter @ag/narrative test && pnpm --filter @ag/option test && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# narrative: 12 tests；option: 7 tests；全仓 46 files / 144 tests passed
```
