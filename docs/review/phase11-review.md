# Phase 11 Simulation / Debug —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`30c3951`（Phase 11 Simulation / Debug）
> 结论：**无阻断项，Phase 11 通过。** 🟠 项为 Golden Test 交付口径确认，建议 Phase 12 前明确。
> 以下按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（74 文件 / 205 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- 批量模拟 + 统计：`simulateRuns(100)` 输出 Ending 分布、平均 Day/Turn/Affection/Trust、Memory 增长、Context 大小、事件/选项频率、成本估算（设计 §1.3 / §7）。
- 确定性可复现：每 Run `XorShift128Rng(seed)`，`fingerprint` 作为 Golden 校验；`simulate / replay / inspect / debug-turn` CLI 齐全。
- Turn Debugger 回放全字段；Inspectors（State / Memory / Context）含 budget 用量校验。
- **Phase 6 review 项闭环**：`pruneMemories` 接线进模拟，Context Explosion 测试通过（200 Turn 下 records ≤ 25、contextMemories ≤ 5）。

---

## 🟠 待确认（非阻断，建议 Phase 12 前明确）

### 1. Golden Test 覆盖"确定性引擎"Replay，计划中"LLM Fixture 的 AI 稳定性 Golden Test"未实现
- 位置：`apps/devtools/src/simulation-engine.ts`（`simulateRun` 用 `renderOptions(planDiverseOptions(4))`，全程不调 LLM）+ `simulation-engine.test.ts`（`replay is deterministic`）
- 问题：DEVELOPMENT_PLAN Phase 11 勾选了"Golden Test：固定 RNG Seed + GameState + LLM Fixture 输出可复现"，但实现只做**无 LLM 的引擎 fingerprint**。模拟不接 LLM，"AI 稳定性 / AI 输出验证"未在 Simulation 层覆盖（Phase 5 生成器有 TestProvider 测试，但不是端到端 Run 级）。
- 处理二选一：
  - **A**：调整 DEVELOPMENT_PLAN 措辞为"确定性引擎 Replay Golden Test"，明确交付口径；
  - **B**：补端到端 Golden Test——用 `TestProvider` fixture 驱动 scenario/options/reaction，`runNarrativeTurn` 跑完整 Run，断言输出与 fingerprint 稳定。

---

## 🟢 建议（不阻塞，择机处理）

### 2. 成本为固定启发式估算
- `simulation-engine.ts` 用 `turns×1200/400` token 估算，非真实用量；接入真实 LLM 时用 Phase 7 的 `usageListener` 替换。

### 3. `pruneMemories` 硬删除超容量记忆
- 语义是"修剪"而非"遗忘"（不进入 `forgottenIds`），建议在文档/注释标注。

### 4. 模拟事件池固定 `demoEvents`
- `SimulationOptions` 未暴露事件定义注入，后续可参数化以测不同世界。

---

## 处理建议

- 🟠 #1 为交付口径确认；🟢 均可选。
- 处理完复跑 `pnpm --filter @ag/devtools test && pnpm build`。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **Golden Test 口径**：采纳方案 B，并同步方案 A。新增 `runGoldenTurn(seed, TestProvider fixture)`，固定 RNG Seed + GameState + LLM Fixture 驱动 `runNarrativeTurn` 完整链路并输出 fingerprint；测试断言同 seed 同 fingerprint。DEVELOPMENT_PLAN 同时明确“确定性引擎 Replay + 端到端 LLM Fixture Golden”交付口径。
2. **成本估算**：代码标注 `TODO(真实 LLM)`，说明当前为启发式 token 估算，接入 usageListener 后替换。
3. **prune 语义**：JSDoc 明确“硬删除修剪”，超容量记录不进入 `forgottenIds`。
4. **事件池参数化**：`SimulationOptions.eventDefinitions` 已支持注入不同世界事件定义。

回归结果：

```text
pnpm --filter @ag/devtools test && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# 全仓 74 files / 206 tests passed
```
