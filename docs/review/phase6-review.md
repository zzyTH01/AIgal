# Phase 6 Memory / Context —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`63dc88c`（Phase 6 Memory / Context）
> 结论：**无阻断项，Phase 6 通过，可进入 Phase 7（LLM Gateway 落地）。**
> 以下为需在进入 Phase 7 前处理/确认的事项，按严重度排列。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（54 文件 / 162 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- 衰减 `S(t)=S₀·e^(−λt)`，λ 受 forgetfulness/retention 影响，负面事件受 grudge 减速、全类受 obsession 减速（§4.8）。
- 检索 `Score = w_r·R + w_i·I + w_e·E + w_s·S + w_o·O`，Top-K，排除遗忘；强化默认 +26（对应 0.42→0.68 示例）。
- 形成 `CandidateScore = Importance × EmotionalIntensity × Novelty × CharacterMemoryFactor`，低于阈值不落库。
- 整合：短期→长期（强度/重要性阈值），长期低强度低重要性→遗忘，`lastConsolidatedDay` 更新。
- Memory ≠ Context：ContextBuilder = GameState + 检索记忆 + 当前事件 + 认知 → ModelContext；budget 比例 3:3:4:4:2、余数优先 Memories、**总和永不超容量**（schema refine 兜底）。
- 验收点全达标：衰减/强化/检索、Context 生成、Budget 不超限、不同认知 Profile → 不同 Context 均有测试。

---

## 🟠 待确认 / 应修（建议 Phase 7 前处理）

### 1. 中文文本相关性退化为"单 token 二值"
- 位置：`packages/memory/src/retrieval.ts:70-75`（`tokenize`）
- 问题：分词正则把连续中文整句当作**一个 token**（如"玩家陪我在图书馆待到很晚"= 1 个 token）。`calculateRelevance` 的文本重叠在中文下近似 **0 或 1**（整句完全相同才命中），对项目的中文记忆内容几乎失效。
- 影响：检索的 `relevance` 通道在中文下接近"废通道"，主要靠 tag 重叠兜底，会削弱"角色真的记得你"的效果。
- 处理二选一：
  - **A（推荐）**：`tokenize` 增加按中文标点切分（`，。！？、；：`）+ 字符 bigram（`玩家/家陪/陪我/…`），让中文有非平凡重叠；
  - **B**：明确标注为机械近似，Phase 11 换语义检索（设计本就规划 Semantic Similarity 为未来组件）。

---

## 🟢 建议（不阻塞，择机处理）

### 2. 衰减起点用 `createdAt.day`
- 位置：`packages/memory/src/decay.ts:16`
- 强化后仍从创建日计算 elapsed，强化"重置衰减时钟"的效果被弱化；可改用 `lastRetrievedAt`（或记录 `lastDecayedDay`）计算 elapsed。

### 3. `records` + `forgottenIds` 只增不减
- 位置：`memory-store.ts` / `consolidation.ts`
- 长 Run 下记忆总量单调增长；Phase 11 Context Explosion 测试会暴露。建议设容量上限或修剪策略。

### 4. 默认检索 query 相关性信号弱
- 位置：`packages/context/src/context-builder.ts:37-40`
- 默认 tags 用 active eventId（与自由 tags 难匹配）、text 用粗粒度 `summarizeGameState`。Phase 9 传入基于当前事件的 query 后相关性才明显。属 Phase 6 机械近似，可接受。

### 5. `formMemory` 初始 strength 与 threshold=100 为经验值
- 位置：`packages/memory/src/formation.ts:60,78`
- 建议 Phase 11 仿真校准。

---

## 处理建议

- 🟠 #1 改动小，直接改代码 + 补中文相关性测试；处理完复跑 `pnpm --filter @ag/memory test && pnpm build`。
- 🟢 均为可选项，可随 Phase 11（Simulation / 平衡）覆盖。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **中文文本相关性**：采纳方案 A。`tokenize` 现按中文标点（`，。！？、；：`）分段，并对连续中文段生成字符 bigram；新增无 tag 的中文检索测试。
2. **衰减起点**：`decayedStrength` 改为从 `lastRetrievedAt?.day ?? createdAt.day` 起算 elapsed，强化/回忆会重置衰减时钟；新增测试。
3. **records/forgottenIds 增长**：已添加 `TODO(Phase 11)`，并记入 `DEVELOPMENT_PLAN.md` Phase 11 任务（容量上限/修剪策略 + 100 Runs 校准）。
4. **默认 query 近似**：ContextBuilder 注释已标明 Phase 6 机械近似，Phase 9 由 Turn 编排传入基于事件的 query。
5. **formation 经验值**：`formMemory` 添加 `TODO(Phase 11)`，校准项已记入开发计划。

回归结果：

```text
pnpm --filter @ag/memory test && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# @ag/memory: 14 tests；全仓 54 files / 164 tests passed
```
