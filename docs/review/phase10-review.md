# Phase 10 Designer Mode —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`0eaa9ca`（Phase 10 Designer Mode）
> 结论：**无阻断项，Phase 10 通过。** 两项 🟠 建议 Phase 11 前处理。
> 以下按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（70 文件 / 197 用例，Designer Vite 构建）/ `pnpm typecheck` / `pnpm lint` 全绿。
- Design→Play 联动：`projectToRuntimeConfig` + `createBlankProject`，Project round-trip 经 `gameProjectSchema` 校验。
- 创建→编译→模拟→导出→导入最小链路完整。
- 浏览器/Node 分离：`@ag/persistence` 根入口仅导出浏览器安全的 repository，`JsonDirectorySaveRepository` 移至 `@ag/persistence/json-directory` 子路径。
- boot 事件可选化；验收全过（Designer 构建、round-trip、Design→Play 模拟）。

---

## 🟠 待确认 / 应修（建议 Phase 11 前处理）

### 1. Designer 目前是"最小表单设计器"，未覆盖验收标准中的编辑器
- 位置：`apps/designer/src/components/ProjectForm.tsx`
- 问题：Phase 10 验收标准为"配置世界/参数/事件/选项模板/Ending/Prompt"；当前表单只覆盖 Character(identity) + 世界名 + Prompt。**World Builder（地点）、Parameter、Event、OptionTemplate、Ending 编辑器均未实现**（底层 schema 已就绪）。
- 影响：核心链路（创建角色→编译→模拟→导出）已成立，但"完整设计器"仅交付骨架。
- 处理：确认交付口径——**接受最小设计器作为 Phase 10 交付**（在 DEVELOPMENT_PLAN 标注范围），或在后续 Phase 补齐编辑器。

### 2. `@ag/runtime → @ag/st-adapter` 依赖方向违背设计
- 位置：`packages/runtime/src/game-runtime.ts:12`（`import { definitionToGameCharacter } from '@ag/st-adapter'`）+ `packages/runtime/package.json`
- 问题：设计 §5.1/§5.4 依赖单向为 `UI → Application → Core → Adapters`，**Application 不应硬依赖具体 Adapter**。`definitionToGameCharacter`（CharacterDefinition→CharacterState）是纯转换，本属 Core/character 范畴，却放在 st-adapter 里导致 runtime 反向依赖。
- 影响：SillyTavern 被"钉死"进 Application 依赖图，违反"Adapter 可替换"原则。
- 处理：把 `definitionToGameCharacter` 移到 `@ag/core`（或 `@ag/character`），st-adapter 与 runtime 都从 Core 引用；消除 runtime→st-adapter 依赖。

---

## 🟢 建议（不阻塞，择机处理）

### 3. `gameProjectSafe` 是 no-op 函数
- 位置：`apps/designer/src/App.tsx:112-114`（`return project`），可删。

### 4. `characterId` 未规范化
- 位置：`apps/designer/src/App.tsx:27`（`char_${form.characterName.toLowerCase()}`）
- 空格/特殊字符会生成非法 id，建议复用 `sanitizeId`。

### 5. Designer 模拟默认用 `DEMO_LLM`
- 无 key 设计器预演合理；正式联调可注入 provider。

---

## 处理建议

- 🟠 #1 为交付口径确认（最小设计器 vs 补齐编辑器）；#2 为消除 runtime→st-adapter 反向依赖（小改动）。
- 🟢 均可选。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **交付口径**：确认 Phase 10 交付为“最小设计器”，已在 `DEVELOPMENT_PLAN.md` §13 注明；World/Parameter/Event/OptionTemplate/Ending 完整编辑器留待后续 Phase 在现有 schema 上补齐。
2. **依赖方向**：`definitionToGameCharacter` 已从 `@ag/st-adapter` 移入 `@ag/core`（纯 Core 转换）；st-adapter 与 runtime 均从 `@ag/core` 引用，并移除 `@ag/runtime → @ag/st-adapter` 依赖。
3. **no-op 清理**：删除 `gameProjectSafe`。
4. **characterId 规范化**：Designer 使用 `sanitizeId` 处理空白字符并回退 `character`。
5. **DEMO_LLM**：保留为无 key 设计器预演默认；正式联调通过注入 provider 配置。

回归结果：

```text
pnpm --filter @ag/core test && pnpm --filter @ag/st-adapter test && pnpm --filter @ag/runtime test && pnpm --filter @ag/designer build && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# 全仓 70 files / 198 tests passed
```
