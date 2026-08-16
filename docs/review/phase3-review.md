# Phase 3 State Resolver —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`f3af063`（Phase 3 State Resolver）
> 结论：**无阻断项，Phase 3 通过，可进入 Phase 4（Event + RNG）。**
> 以下为需在进入 Phase 4 前处理/确认的事项，按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（34 文件 / 109 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- 结算公式精确落地：`ΔX = round(Base × Personality × Relationship × Context × Emotion × Repetition × Risk × Nonlinear)` + Clamp 0~100（Master Design §4.10）。
- 三阶段 delta + 完整 `trace`（base / modifier / final + 每指标乘数明细），为 Phase 11 Turn Debugger 打底。
- Risk 分支经注入 RNG Port；非法 AI 数值（|base|>100/NaN/Infinity）忽略并行为 fallback；非线性（近界衰减）与重复反馈闭环（`observePlayerChoice` 已接入 Turn 路径）均生效。
- "同行为不同角色不同结果"真实落地：独立型角色对 support 负好感、依赖型正好感。

---

## 🟠 待确认 / 应修（建议 Phase 4 前处理）

### 1. 重复反馈衰减比设计示例约陡一倍
- 位置：`packages/core/src/state-resolver.ts:319-332`（`calculateRepetitionModifier`）
- 问题：把 option 的**全部** actions（如 support 含 3 个）同时计入 `recent + historical`。实测连续第 2 次选相同选项时 `count≈6 → 倍率 0`（零收益），第 3 次即转负；而设计示例为"第 1 次 +5 / 第 2 次 +3 / 第 3 次 +1 / 第 4 次 -2"。
- 影响：核心手感偏激进（不是正确性 bug，"刷好感无效"已达成）。
- 处理二选一（或组合）：
  - **A**：只按**主导行为**（`behavior.actions[0]`）计数，其余 action 不参与重复判定；
  - **B**：放缓斜率（如 `1 - (count - 1) * 0.1`），并 clamp 下限。
  - 无论 A/B：在 Phase 11 用 100 Runs 仿真校准"几次重复后转负"落在设计预期内。

---

## 🟢 建议（不阻塞，择机处理）

### 2. Resolver 目前只解析 relationship 数值
- 位置：`packages/core/src/state-resolver.ts:84-141`
- `option.effects` 中针对**角色心理 / 体力 / world / run** 的效果尚未接入（base/direct delta 目前仅含 relationships + turn 的 run 字段）。
- 建议在文件头注释与 DEVELOPMENT_PLAN 中**标明本阶段范围**，角色/world 效果留待后续 Phase 显式实现，避免下游误以为已支持。

### 3. 个性-行为映射与风险倍率为硬编码
- 位置：`state-resolver.ts:249-250`（独立型反感 help 的 `-0.5`）、`199-203`（风险倍率）
- 建议后续改为由 CharacterDefinition / Project 参数**数据驱动**，便于设计者调平衡。

---

## 处理建议

- 🟠 #1 为平衡点确认，改动小；处理完复跑 `pnpm --filter @ag/core test && pnpm build`。
- 🟢 均为可选项，可在后续 Phase 随实现覆盖。
- 处理完成后请更新 DEVELOPMENT_PLAN 相应说明。

---

## ✅ 修订记录（实现侧，2026-08-16）

已按本反馈在进入 Phase 4 前完成处理：

1. **重复反馈过陡**：采纳方案 A。`calculateRepetitionModifier` 与 `observePlayerChoice` 现在只统计**主导行为**（`behavior.actions[0]`）；recent 与 historical 两个流取 `max`，避免同一观察被双计。连续选择同一选项时重复倍率依次为 `1 → 1 → 0.8 → 0.6 → 0.4 → 0.2 → 0 → 负值`，具体转负轮数留待 Phase 11 用 100 Runs 仿真校准。
2. **Phase 3 范围显式化**：`state-resolver.ts` 文件头注明本阶段仅结算 relationship 数值效果；character / world / run effects 留待后续 Phase 显式实现。`DEVELOPMENT_PLAN.md` §6 已同步该范围说明。
3. **硬编码映射与风险倍率**：在个性-行为映射与风险倍率处添加 `TODO(Phase 10/11)`，计划后续改为 CharacterDefinition / Project 参数数据驱动。

回归结果：

```text
pnpm --filter @ag/core test && pnpm --filter @ag/core build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# @ag/core: 33 tests passed；全仓 34 files / 109 tests passed
```
