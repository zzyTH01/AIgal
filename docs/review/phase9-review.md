# Phase 9 Minimal Play UI —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`babf90b`（Phase 9 Minimal Play UI）
> 结论：**无阻断项，Phase 9 通过。** 两项 🟠 为"把已就绪模块接进 Runtime"的小改动，建议 Phase 10/11 前处理。
> 以下按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（67 文件 / 191 用例，jsdom + React Testing Library）/ `pnpm typecheck` / `pnpm lint` 全绿。
- Application API 端点齐全：`/game/start /turn/start /turn/choice /game/state /save /load /export`，错误包装为 `ApiResult`。
- Turn Orchestrator（`GameRuntime`）串联全部服务：事件选择 → **事件写入 world.activeEvents（Phase 4 接线点闭环）** → ContextBuilder → 合并生成（Phase 7，2 次调用）→ StateResolver 结算 → **Reaction 注入结算结果（Phase 5 保持）** → 记忆形成/跨日整合（Phase 6）→ Turn 事务提交。
- UI 无自由输入框，玩家只做选择；验收全过（端到端 Turn 循环、组件、错误处理）。

---

## 🟠 待确认 / 应修（建议 Phase 10/11 前处理）

### 1. 存档/读档是内存 Map，未接 `@ag/persistence`
- 位置：`packages/runtime/src/game-runtime.ts:118,261-274`（`saves = new Map<string, GameState>`）
- 问题：设计"存档从第一版就应视为核心系统"（§5.8：`saves/run_017/{manifest,state,memories,...}`）；`@ag/persistence` 包已存在但未接线。当前刷新页面即丢档。
- 处理：`save/load` 接 `@ag/persistence` 的 JSON Directory 落盘；若作为 Phase 9 演示限制，需在文档/CLAUDE.md 显式标注。

### 2. RNG 恒为 `ALWAYS_SUCCESS_RNG`，`seed` 形同虚设
- 位置：`game-runtime.ts:130`（`this.rng = ALWAYS_SUCCESS_RNG`）+ `:143`（`startGame(seed)` 仅写 `state.rng.seed`，未用于 RNG 实例）
- 问题：Phase 4 已提供可复现 `XorShift128Rng`，但 Runtime 未接线 → **风险永远成功、事件选择确定性化**，"随机世界/Roguelike"在真实 Run 中不生效。
- 处理：构造/启动时 `this.rng = createSeededRng(seed)`，让风险分支与事件选择真正随机且可复现（Replay/Golden 测试需要）。

---

## 🟢 建议（不阻塞，择机处理）

### 3. `definitionToGameCharacter` 两处重复
- 位置：`game-runtime.ts:281` 与 `@ag/st-adapter/character-card.ts:121` 逻辑相同。
- 建议：runtime 从 st-adapter（或共享工具）导入，消除重复。

### 4. Application API 是进程内调用，非 HTTP 端点
- 设计 §5.4 为 `POST /turn/choice`；Phase 9 最小实现可接受，真实部署/联调时再考虑 HTTP 包装。

### 5. UI 无 load 按钮
- `load` 在 API 层存在，界面只有 save/export；可加"读档"入口。

---

## 处理建议

- 🟠 #1、#2 都是"把已就绪的模块接进 Runtime"（@ag/persistence + XorShiftRng），改动小；处理完复跑 `pnpm --filter @ag/runtime test && pnpm build`。
- 🟢 均可选。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **存档/读档接线**：`@ag/persistence` 已实现 `SaveRepository`、`MemorySaveRepository` 与 `JsonDirectorySaveRepository`（`saves/<saveId>/{manifest.json,state.json}`）。`GameRuntime.save/load` 改为 async 并默认使用 Memory 仓库；传入 `savesDir` 或 `persistence` 即落盘 JSON Directory。UI 增加“读档”按钮。
2. **RNG 接线**：`GameRuntime.startGame(seed)` 现在构造 `XorShift128Rng(seed)`，并将 `rng.save()` 写入 `GameState.rng`；事件选择与 Risk 分支开始使用可复现随机数。
3. **重复函数消除**：runtime 移除本地 `definitionToGameCharacter`，改从 `@ag/st-adapter` 导入。
4. **HTTP 包装**：Phase 9 仍保持进程内 Application API（设计 §5.4 的 HTTP 形态留待部署阶段）。
5. **UI 读档**：SavePanel 增加“读档”按钮，App 记录最近 saveId 并支持读回。

回归结果：

```text
pnpm --filter @ag/runtime test && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# runtime: 5 tests；persistence: 3 tests；player: 2 tests；全仓 68 files / 194 tests passed
```
