# Phase 4 Event + RNG —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`988855b`（Phase 4 Event + RNG）
> 结论：**无阻断项，Phase 4 通过，可进入 Phase 5（Narrative / Option Engine，首次接 LLM）。**
> 以下为需在进入 Phase 5 前处理/确认的事项，按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（38 文件 / 123 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- `XorShift128Rng` 标准实现，`save()/fromState()` 对齐 `RNGState {seed,state,algorithm}` 契约，`next()` 返回 [0,1) 兼容 Phase 3 RNG Port；**Replay 测试通过**。
- 事件选择公式精确落地：`EventScore = BaseWeight × ContextMod × CharacterMod × RelationshipMod × RarityMultiplier × RandomFactor`（Master Design §2.6 + 稀有度权重）。
- 资格过滤完整：conditions / 地点 / 所需角色（active）/ 关系类型 / 双冷却（天 + 回合）；加权随机 + 空池兜底。
- 验收点全达标：权重分布可调（1:9 ↔ 9:1 反向）、冷却、稀有度、Replay 均有测试。

---

## 🟠 待确认 / 接线（非阻断，但务必在 Phase 5/9 落实）

### 1. 天数冷却的"写入点"尚未接线 —— 后续 Phase 的硬性集成点
- 位置：
  - `packages/world/src/event-selection.ts:76-85` —— `isOnCooldown` 天数分支读取 `world.publicEvents/activeEvents` 的 `lastTriggeredDay`
  - `packages/world/src/event-pool.ts:41-48` —— `recordTriggered` 注释声明"调用方应同步 lastTriggeredDay = day"
- 问题：Phase 4 的 `selectEvent` **只返回 EventInstance，不会把事件写入 world**。天数冷却逻辑正确（测试为手工填充 world 验证），但真实触发链路上暂无写入点。
- 影响：若 Phase 5/9 的 Turn 编排不补上"事件触发后写入 `world.activeEvents` 并设 `lastTriggeredDay`"这一步，**天数冷却会静默失效**（回合冷却由 EventPool 内部 `lastTriggeredTurns` 记录，不受影响）。
- 处理：在 `DEVELOPMENT_PLAN` Phase 5/9 任务清单中显式标记该接线为必做项，并补一条端到端冷却测试。

---

## 🟢 建议（不阻塞，择机处理）

### 2. `save().seed` 存的是状态字而非原始种子
- 位置：`packages/world/src/rng-service.ts:48-54`
- `save()` 将 `this.s[0]` 写入 `seed` 字段；`fromState` 用 `state` 数组恢复，**Replay 正确**（有测试），但 `RNGState.seed` 语义与契约"原始种子"不符，Debug 展示 seed 会失真。
- 建议：类内保存原始 seed，`save()` 写回它。

### 3. `randomFactor` 限定 [0.5, 1.0)
- 位置：`event-selection.ts:163`（`0.5 + rng.next() * 0.5`）
- 随机扰动被压缩在 50%~100%。若希望更强随机波动，Phase 11 仿真校准时可放宽（如 [0.2, 1.2]）。

### 4. `rankEvents` 的 sort 对加权选择是冗余的
- 位置：`event-selection.ts:154-167`
- `pickWeighted` 按累积分数选择，顺序不影响分布；sort 无害，可留作调试排序。

---

## 处理建议

- 🟠 #1 是**接线点**而非本阶段 bug：请在 Phase 5/9 任务清单中显式落实"事件触发后写入 world.activeEvents + lastTriggeredDay"，并补端到端冷却测试。
- 🟢 均为可选项。
- 本阶段无代码修改强制要求；若处理 🟢 #2 请在 `packages/world` 复跑 `pnpm --filter @ag/world test && pnpm build`。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **天数冷却写入点**：已在 `DEVELOPMENT_PLAN.md` Phase 5 任务清单中显式增加必做项——“事件选择成功后写入 `world.activeEvents`（`lastTriggeredDay`）并调用 `EventPool.recordTriggered`，补端到端天数/回合冷却测试”；Phase 9 任务清单中增加接线复核项。
2. **`save().seed` 语义**：`XorShift128Rng` 现保存构造时传入的原始 seed（新增 `originalSeed` 字段）；测试断言 `save().seed === 99`。
3. **`randomFactor` 区间**：在代码注释中标注 Phase 11 仿真校准时可放宽扰动区间（如 `[0.2, 1.2]`）。
4. **`rankEvents` sort**：保留排序并在注释中说明仅用于调试/检查，加权选择结果与顺序无关。

回归结果：

```text
pnpm --filter @ag/world test && pnpm --filter @ag/world build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# @ag/world: 15 tests passed；全仓 38 files / 123 tests passed
```
