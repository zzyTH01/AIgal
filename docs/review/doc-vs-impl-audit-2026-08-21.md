# 文档 vs 实现 差异审计与修复记录（2026-08-21）

> 审计方式：逐包核对 `AI_GALGAME_Master_Design_v1.0.md`（内容版本 v1.3）、`COMPLETION_PLAN.md`、`docs/review/known-issues.md` 的声明与 `packages/*`、`apps/*` 实际代码，全部结论带 file:line 证据。
> 本文分两部分：**一、发现的差异**；**二、本次已修复项**；遗留缺口见文末"仍未解决"。

---

## 一、发现的差异

### A. 文档自身不一致

| # | 问题 | 事实 |
|---|---|---|
| A-1 | 版本号漂移 | 文件名 `_v1.0.md`；CLAUDE.md 曾写 v1.0/v1.1；README 写 v1.1；文档内自称 **v1.3**（含 §11 Life Engine）。以文件内容为准 |
| A-2 | CLAUDE.md 未反映 §11 | Master Design §11 六个子系统（Transition/Pending Intent/Autonomous Event/Micro Event/Relationship Narrative State/Event Scheduler）已定案未实现，但 CLAUDE.md 进度区未提及 → 已修正 |
| A-3 | "全部完成"表述过强 | Completion Plan 多个 ✅ 实为"实现了但没接线"（见 B 类）；Phase H 自认"真实 LLM 手动联调仍待环境执行" |

### B. 组件已实现但未接入生产路径（本次修复，见第二节）

| # | 组件 | 审计时状态 |
|---|---|---|
| B-1 | **ContextCache**（§5.5 / U-5） | `packages/context/src/cache.ts` 功能与 hit/miss 统计完整，但 `new ContextCache` 全仓只在测试出现；且 `context-builder.ts` 中 stable summary 返回值被丢弃——缓存即使传入也不产生效果 |
| B-2 | **记忆强化 Reinforcement**（§4.8"回忆会强化记忆"） | `retrieveAndReinforce`（`memory/retrieval.ts:122`）生产零调用；runtime 检索走裸 `retrieveMemories`，检索不触发强化 |
| B-3 | **pruneMemories**（Phase 11 容量控制） | 只接在 devtools 仿真器（`simulation-engine.ts:183`）；主游玩路径不修剪，`decay.ts:38` TODO 自认 records+forgottenIds 只增不减 |
| B-4 | **一致性规则注入**（U-4） | `checkNarrativeConsistency` 支持 forbiddenTopics/allowedCharacters，但生产无任何调用方传参（等于只查非空）；且 runtime 实际使用的合并生成器 `combined-generator.ts` **完全没有**接一致性检查（仅独立 scenario/reaction 生成器有） |
| B-5 | **llmMaxAttempts 写死 1** | `game-runtime.ts` 两处硬编码 `{ maxAttempts: 1 }`，Retry→Fallback 链在生产被压缩为单次尝试 |

### C. 设计承诺但缺失或严重简化（未在本轮修复范围）

| # | 设计出处 | 实际情况 |
|---|---|---|
| C-1 | §11 Life Engine 六子系统（P0–P5） | 完全未实现；实现计划在 `EVENT_LIFE_PLAN.md`。**最大的已声明缺口** |
| C-2 | §4.10 Option 两阶段生成 | Planning→Realization 压缩进单次 LLM 调用；Realization 退化为渲染+机械兜底文本（`option/renderer.ts:11-16`） |
| C-3 | §5.5 LLM Gateway 五 Provider | 只有 OpenAI / Anthropic / OpenAI-Compatible / TestProvider；无 Gemini / Local |
| C-4 | §5.8 Persistence 内容 | 仅 `manifest.json + state.json`；设计承诺的 memories/history/每 turn 记录/meta 独立文件不存在；load 不做 schema 校验（`json-directory-repository.ts:31-34`） |
| C-5 | §5.4 Application API HTTP 形态 | 进程内类调用，全仓无 HTTP server（known-issues #12） |
| C-6 | Phase G"设计器编辑器补齐" | 实际单一表单 7 字段（`ProjectForm.tsx:26-71`）；locationName/dayLength/eventTitle/endingTitle/optionTemplateActions 有数据通道无编辑 UI |
| C-7 | §5.7 Replay | 最小形态：重跑 simulateRuns 打印 fingerprint，无历史文件回放 |
| C-8 | PNG 卡导入 / 真实 ST 集成 | 不存在（`adapters/sillytavern/types.ts:3` 明示留给导入器）；Extension 为进程内协议骨架 |

### D. 表现层占位（Phase 12 ✅ 名不符实部分）

- 立绘/背景：组件支持 `src` 真图，但 `App.tsx` 不传 src，实际永远 CSS 渐变占位
- 音频面板：纯占位 disabled（`AudioPanel.tsx`）
- CG 缩略图为渐变块；策略提示为两条硬编码阈值规则

### E. 经验值债务（代码 TODO 自认，需校准）

- `core/state-resolver.ts:302`：人格→modifier 映射硬编码，应数据驱动
- `memory/formation.ts:78`：形成阈值=100、初始 strength 经验值，未做 100 Runs 校准
- `devtools/simulation-engine.ts:237`：成本启发式估算，未接 usageListener
- `option/validator.ts:31-45`：四类动作词表硬编码精确匹配，表外 LLM 动词静默失分类

### F. 已验证属实（文档可信部分）

二次结算、PlayerModel 更新、跨局 Meta 闭环、policy 注入 prompt、记忆指数衰减 `S₀e^(−λt)`（含 grudge/obsession 减速）、ContextBudget 按认知能力分配 Top-K、多样性 soft 模式、reaction prompt 引导 memoryCandidates、双层 Retry→Fallback 结构、known-issues #4(POV)/#5(记忆注入) 的修复均在代码中确认。

---

## 二、本次修复（2026-08-21）

### Fix-1 ContextCache 接入生产路径（B-1）

- `packages/runtime/src/game-runtime.ts`：`GameRuntime` 持有 `ContextCache`，`startTurn` 的 `buildContext` 传入 `cache`；新增 `getContextCacheStats()` 暴露 hit/miss。
- `packages/context/src/context-builder.ts`：stable summary 不再丢弃，拼入 systemRules 进入 system prompt（对应 §5.5"Stable Personality 缓存"语义）。

### Fix-2 检索强化接入主循环（B-2）

- `game-runtime.ts` `startTurn`：context 组装后对 `retrievedMemories` 逐条调用 `reinforceMemoryRecord`（strength+26 封顶 100、retrievalCount+1、lastRetrievedAt 重置衰减时钟），落实 §4.8 Retrieval→Reinforcement。

### Fix-3 记忆修剪接入主路径（B-3）

- `game-runtime.ts` `chooseOption`：记忆形成/巩固后调用 `pruneMemories(next, { maxRecords })`；新配置 `RuntimeConfig.memoryPruneLimit`（默认 100），长 Run 不再无限增长。

### Fix-4 一致性规则贯通（B-4）

- `packages/narrative/src/combined-generator.ts`：`CombinedGeneratorOptions` 新增 `consistency`，场景文本过 `checkNarrativeConsistency`，失败走 Retry→Fallback（补齐合并路径的 U-4 缺口）。
- `game-runtime.ts`：新配置 `RuntimeConfig.consistency`（forbiddenTopics/allowedCharacters）同时注入 Scenario 与 Reaction 生成。

### Fix-5 llmMaxAttempts 可配置（B-5）

- 新配置 `RuntimeConfig.llmMaxAttempts`（默认 1 保持现行为），替换两处写死。

### 测试

新增 5 个用例（`packages/runtime/src/game-runtime.test.ts`）：检索强化生效、缓存统计跨 Turn 提升、超限修剪、一致性规则触发 Scenario+Reaction fallback、flaky LLM 按 llmMaxAttempts 重试成功。

最终回归：`pnpm build && pnpm test && pnpm typecheck && pnpm lint` 全绿（82 test files / 239 tests）。

---

## 三、仍未解决（按优先级）

1. **Life Engine P0–P5**（C-1）——按 `EVENT_LIFE_PLAN.md` 开工。
2. 真实 LLM 手动联调复验（Completion Plan Phase H 遗留）：接线修复后需复测 source 占比、记忆形成与强化对长对话的影响。
3. Persistence 补齐 per-turn history/meta 独立落盘 + load schema 校验（C-4）。
4. 设计器编辑器 UI（C-6）、HTTP Application API（C-5）、PNG 卡导入（C-8）、Gemini/Local Provider（C-3）。
5. 表现层真实资源接入（D）；经验值校准与成本真实计量（E）。

> 备注：本轮 `pnpm format` 顺带格式化了三个此前未过 Prettier 检查的 md（`long-run-artoria.md` 等），属 lint 硬性要求的补充修正。
