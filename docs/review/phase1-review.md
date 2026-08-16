# Phase 1 数据契约冻结 —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`ca0dbd2`（Phase 1）+ `4541d92`（Phase 0.5 收尾）
> 结论：**无阻断项，Phase 1 通过，可进入 Phase 2。**
> 以下为需在 Phase 2 开始前处理/确认的事项，按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（27 文件 / 75 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- StateDelta 三阶段（base/modifier/final）判别联合、MemoryCandidate 先提后确认、TurnResult 携带 stateBefore/finalState、NPC 双通道、ContextBudget 约束、成年边界 age≥18、Schema 全部 `.strict()`、JSON Schema 由 Zod 同源生成并经 Ajv 2020-12 校验 —— 均与设计一致，质量良好。

---

## 🟠 待确认 / 应修（建议 Phase 2 前处理）

### 1. `LocationState.accessibility` 类型：`string` vs 契约 `number`
- 位置：`packages/schemas/src/world.ts:26`、`packages/schemas/src/project.ts:32`
- 问题：v0.1 数据契约中 `accessibility: number`（可及性百分比 0~100）。当前实现两处均为 `z.string()`，偏离设计意图；且 `project.ts` 与 `world.ts` 该字段语义应一致。
- 处理二选一：
  - **A（推荐）**：改为 `accessibility: percentSchema`（0~100），两个 schema 同步；
  - **B**：确认 string 是有意为之，并在 `AI_GALGAME_Master_Design_v1.0.md` §4.6 明确冻结 string 语义。

### 2. `LocationState` 缺少 `locationId` / `name`
- 位置：`packages/schemas/src/world.ts:22-31`
- 问题：v0.1 契约中 `LocationState` 含 `locationId`、`name`。当前实现仅有 `type/tags/accessibility/active/currentCharacters`。记录 key 虽然即 id，但 **`name`（显示名）是后续 UI 必需的**；`project.ts` 的 `ProjectLocationDefinition` 有 `locationId`/`description` 但也无 `name`。
- 处理：两个 schema 均补充 `name: z.string().min(1)`；`LocationState` 视需要补充 `locationId`。

### 3. `WorldEventState` 相对 v0.1 契约字段差异较大
- 位置：`packages/schemas/src/world.ts:36-46`
- 问题：v0.1 契约为 `{ eventId, type, title?, startDay, endDay?, locationIds?, characterIds?, importance, active, tags }`；当前实现为 `{ eventId, type, rarity, title, description, weight, lastTriggeredDay? }`，删除了前者多数字段、新增 `rarity/weight/lastTriggeredDay`。
- 判断：`weight/rarity/lastTriggeredDay` 显然是 Phase 4 事件权重选择所需，改动方向合理。
- 处理：请将该字段定义**正式冻结到 `AI_GALGAME_Master_Design_v1.0.md` §4.6**（或 §2.6），使权威文档与代码一致；若 `startDay/endDay/importance/active/tags` 确不再需要，也在文档中说明删除理由。

---

## 🟢 建议（不阻塞，择机处理）

### 4. JSON Schema 全内联导致文件巨大
- 位置：`packages/schemas/src/json-schema.ts:61`（`$refStrategy: 'none'`）
- 影响：`save.schema.json` 5330 行、`turn-result.schema.json` 4017 行，嵌套 schema 内容大量重复。
- 处理：可改用 `$defs` + `$ref` 减小体积；或接受现状，但在 `packages/schemas/schemas/README.md` 注明"生成文件，勿手改，以 `src/*.ts` 为源"。

### 5. `RunState.day` 允许 0
- 位置：`packages/schemas/src/game-state.ts:24`
- v0.1 契约 `day` minimum 为 1。若 Day 0 是合法准备态可保留 `nonnegative()`；否则改为 `min(1)`。

### 6. `WeatherType / LocationType / EmotionType` 枚举降为普通 string
- 位置：`world.ts:14`（weather.type）、`world.ts:22`（location.type）、`character.ts:52`（emotion.primary）
- 符合"身份字段用字符串保持灵活"的哲学，可接受；建议至少为 `weather.type` 在文档/注释中列出允许值（clear/cloudy/rain/storm/snow/fog/wind/other），避免下游随意取值。

### 7. JSON Schema 测试 `expectedFiles` 未覆盖全部生成文件
- 位置：`packages/schemas/src/json-schema.test.ts:12-25`
- registry 实际生成 14 个文件（含 `event-instance.schema.json`、`memory-record.schema.json`），测试只断言 12 个。建议补齐，防止未来新增 schema 后文件缺失不报错。

---

## 处理建议

- 🟠 1、2 是**数据契约一致性**问题，建议直接改代码（改动小）；3 是**文档冻结**问题，请同步更新 Master Design。
- 🟢 均为可选项。
- 处理完请更新 `DEVELOPMENT_PLAN.md`（如契约有变），并复跑 `pnpm --filter @ag/schemas test && pnpm build`。

---

## ✅ 修订记录（实现侧，2026-08-16）

已按本反馈在进入 Phase 2 前完成处理：

1. **accessibility**：`world.ts` 与 `project.ts` 均改为 `percentSchema`（0~100），采纳方案 A。
2. **LocationState**：两处 schema 均补充 `name`；`LocationState` 同时补充 `locationId`。
3. **WorldEventState 正式冻结**：已写入 `AI_GALGAME_Master_Design_v1.0.md` §4.6，并说明相对 v0.1 字段的裁定与删除理由；Master Design 升为 v1.2。
4. **JSON Schema 全内联**：接受现状，并在 `packages/schemas/schemas/README.md` 注明“生成文件，勿手改，以 `src/*.ts` 为源”。
5. **RunState.day**：改为 `min(1)`；`WorldState.day`、`ProjectWorldDefinition.startDay` 同步为 `min(1)`。
6. **weather.type**：代码注释与 Master Design §4.6 约定允许值 `clear/cloudy/rain/storm/snow/fog/wind/other`。
7. **JSON Schema 测试**：`expectedFiles` 已补齐全部 14 个生成文件（含 `event-instance`、`memory-record`）。

回归结果：

```text
pnpm --filter @ag/schemas test && pnpm --filter @ag/schemas build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# 27 test files / 77 tests passed
```
