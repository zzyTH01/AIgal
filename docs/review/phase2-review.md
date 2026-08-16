# Phase 2 Pure Game Core —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`4e9374e`（Phase 2 Pure Game Core）
> 结论：**无阻断项，Phase 2 通过，可进入 Phase 3（State Resolver）。**
> 以下为需在 Phase 3 开始前处理/确认的事项。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（33 文件 / 101 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- **Turn 原子事务**落实：`TurnTransaction` 提供 `stateBefore/currentState`、`commitTurn`、`settle`、`rollback`（回滚后 `committed=false` 且可重结算）。
- **Turn ID** 符合 `run_017/day_008/turn_124` 规范。
- **StateDelta 唯一写入路径**：`applyDelta` 只消费 `final` phase；`memoryCandidates` 被刻意忽略（待 Phase 6 Memory Engine 确认后落库）。
- **Run 与 World 的 day/time 单向同步**；50+ Turn 模拟不破坏状态且不突变输入。
- RuleEngine 条件路径解析、Ending 判定（condition + priority，Good/Normal→completed、Bad→bad_end）设计合理。

---

## 🟠 待确认 / 应修（建议 Phase 3 前处理）

### 1. Turn 跨日推进时 `world.weekday` 未推进（天数推进逻辑两处分裂）
- 位置：
  - `packages/core/src/turn.ts:56-60` —— `resolveChoice` 内联天数推进（day+1 / progress=0 / time 重置，**未动 weekday**）
  - `packages/core/src/progress-engine.ts:46-56` —— `advanceDay` 天数推进（会 `weekdayAfter(weekday, 1)`）
- 问题：两处**各自实现天数推进**（`turn.ts` 未引用 `progress-engine`），违反"一个核心状态一条权威写入路径"原则。Turn 路径跨日后 `world.weekday` 失步（如 Day 2 仍显示 monday）。
- 影响：当前 50 Turn 模拟测试未断言 weekday，故未暴露；后续 World/UI 会显示错误星期。
- 处理：
  - **A（推荐）**：`resolveChoice` 的天数推进委托 `addDailyProgress` / `advanceDay`（单一来源），或至少在 runDelta 落 `day/time` 时同步推进 `world.weekday`；
  - **B**：若保留内联，则补一行 `nextWorld.weekday = weekdayAfter(...)` 并保证与 `progress-engine` 逻辑一致。
  - 无论 A/B，请补一条测试：跨日后 `world.weekday` 正确推进。

---

## 🟢 建议（不阻塞，择机处理）

### 2. `applyDelta` 中 emotion.valence 双重钳制
- 位置：`packages/core/src/game-state.ts:343-346`
- 现状：先 `applyMetricChanges(emotion, ..., 0, 100)` 把 valence 钳到 0~100，再用 `-100~100` 显式覆盖。
- 结果正确但冗余；建议单独处理 valence（-100~100），其余 emotion 字段用 0~100。

### 3. `addDailyProgress` 中多余同步
- 位置：`packages/core/src/progress-engine.ts:31`
- `next.world.currentLocationId = next.run.currentLocationId` 无实际作用，可删。

---

## 处理建议

- 🟠 #1 是**数据一致性**问题，改动小，建议直接改代码 + 补测试。
- 🟢 均为可选项。
- 处理完复跑 `pnpm --filter @ag/core test && pnpm build`，确认 101+ 用例仍全绿后进入 Phase 3。

---

## ✅ 修订记录（实现侧，2026-08-16）

已按本反馈在进入 Phase 3 前完成处理：

1. **Turn 跨日 weekday 失步**：采纳方案 A。`resolveChoice` 不再内联天数推进，改为先应用 `turn + dailyProgress` 的直接 delta，再通过 `isDayComplete` 判断并委托 `progress-engine.advanceDay` 完成 `day+1 / progress 清零 / time 重置 / weekday 推进`。新增测试：跨日后 `world.weekday === tuesday`，并断言 `world.day/time` 与 `run.day/time` 同步。
2. **emotion.valence 双重钳制**：`applyDelta` 现将 `valence` 从 emotion 变更集中拆出，单独按 `-100~100` 钳制；其余 emotion 字段按 `0~100` 钳制。
3. **addDailyProgress 多余同步**：已删除 `next.world.currentLocationId = next.run.currentLocationId`。

回归结果：

```text
pnpm --filter @ag/core test && pnpm --filter @ag/core build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# @ag/core: 26 tests passed；全仓 33 files / 102 tests passed
```
