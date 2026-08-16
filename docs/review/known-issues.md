# 已知问题清单（Known Issues）

> 记录时间：2026-08-16 ｜ 审查侧汇总：目前仓库中**已确认的问题**与**待办项**。
> 按严重度排列。🔴 高优先级（影响核心体验）／🟠 应修（影响完整性）／🟢 低优先级（随资源/部署覆盖）。

---

## 🔴 高优先级

### 1. `optionConditionsSchema` 过严导致真实 LLM 高概率回退 —— ✅ 已修复（2026-08-16）
- 修复：`@ag/schemas` 新增 LLM 侧宽松 schema（`llmOptionConditionValueSchema`，允许数组/null/带额外键）；`@ag/option` 的 `renderOption` 用 `sanitizeOptionConditions` 清洗为严格 `OptionConditions`；两个 prompt 约束 conditions 形状。
- 测试：`sanitizes messy LLM conditions instead of falling back` 覆盖 `{min,extra}` / `requires:[...]` / `null`，断言 `source: llm`。

### 2. 多样性校验瓶颈 —— 真实 LLM 合并生成仍高概率回退（本次完整一局新确认）
- 位置：`packages/option/src/validator.ts:28-31`（`ACTIVE/CONSERVATIVE/SOCIAL/RISK_ACTIONS` 硬编码动作表）+ `packages/narrative/src/combined-generator.ts`（`validateOptions` 强校验）
- **现象**（用 DeepSeek + 明日香跑完整一局，20 Turn）：
  - 🔴 #1 修复后，conditions 已不再是主因；
  - 但 `validateOptions` 要求选项**必须覆盖 4 类**（active/conservative/social/risk），类别靠**硬编码动作列表**映射；
  - DeepSeek 生成的动作（如 `approach`、`physical_comfort`、`tease` 等）常不在表内 → 4 类覆盖不足 → **整份合并响应（场景 + 选项一起）回退**。
- **实测影响**：真实 LLM 下**场景+选项几乎每轮 fallback**（"场景生成回退"）；NPC 反应约 50% 真实 / 50% fallback。
- **修复方向**（择一或组合）：
  - **A**：扩充 4 类动作表，覆盖更常见的 LLM 动作词；
  - **B**：LLM 选项的多样性校验降级为"软约束"——缺失时不回退整份响应，仅记录/提示；
  - **C**：场景与选项解耦回退——场景生成失败不回退选项，反之亦然（当前合并生成是"一损俱损"）。

### 3. Bad End → Punishment → Meta Progression → New Run 跨局引擎未实现（设计有、计划漏排）
- 设计依据：`AI_GALGAME_Master_Design_v1.0.md` §2.5（跨 Run 保留 Knowledge/Meta Memories/Unlocks/Achievements/Ending Archive/Permanent Modifiers）与 §9.1 验收（…Ending → Punishment → Meta Progression → New Run）。
- **现状**：`MetaState` 数据契约与 `applyDelta` 的 `knowledge/permanentModifiers` 写入已实现（Phase 1）；但 **Punishment 引擎（Bad End 叙事、Debuff/知识/解锁/永久修正的生成）与跨 Run 继承流程（新 Run 以继承的 MetaState 开局）未实现**。
- 根因：Master Design **有设计**（§2.5 等），但 `DEVELOPMENT_PLAN` 的 Phase 0.5–12 **没有排任何阶段/任务**负责实现这条闭环 → 实现到 Phase 12 后仍是空白。
- 修复方向：新增实现——`punishment-engine`（Bad End → 生成惩罚/知识/解锁）+ 跨局流程（Run 结束时把 `MetaState` 持久化，新 Run 初始化时继承）。

---

## 🟠 应修 / 待排期（既有 review 标记的 TODO）

### 4. Memory / 平衡参数为经验值，未校准
- `formMemory` 初始 strength、阈值（`formation.ts`）；重复反馈转负轮次（`state-resolver.ts`）。
- 已记 `TODO(Phase 11)` 与 DEVELOPMENT_PLAN 校准任务。

### 5. 成本估算为启发式
- `simulation-engine.ts` 用 `turns×1200/400` token 估算，非真实用量；已标 `TODO(真实 LLM)`，接入 `usageListener` 后替换。

### 6. 设计器为最小版
- World Builder / Parameter / Event / OptionTemplate / Ending 编辑器未实现（schema 已就绪）；`apps/designer` 已增强（地点/进度/事件/Ending 标题字段），OptionTemplate 编辑器仍缺。

---

## 🟢 低优先级（随资源接入 / 部署覆盖）

### 7. 立绘/背景为 CSS 占位
- 真实资源应从 `GameProject.assets`（schema 已就绪）接入；`CharacterPortrait` 已带情绪，可作"情绪换立绘"挂点。

### 8. TTS / BGM / SE 为 disabled 占位
- 符合 V1"全语音暂不作核心"；接入时在 `AudioPanel` 接线。

### 9. PNG 元数据卡嵌入 / 真实 SillyTavern 实例联调未做
- `@ag/st-adapter` 提供 JSON Card 编解码与 Extension 协议，但"加载进运行中的 ST / PNG 卡"是部署层工作。

### 10. Application API 为进程内调用
- 设计 §5.4 为 `POST /turn/choice` HTTP 形态；当前 `ApplicationApi` 是程序化 API，HTTP 包装留待部署。

### 11. `pruneMemories` 为硬删除修剪
- 超容量记忆直接删除，不进 `forgottenIds`（语义"修剪"≠"遗忘"）；已 JSDoc 标注。

---

## 真实 LLM 完整一局验证记录（2026-08-16）

用 DeepSeek（openai-compatible）+ 明日香预设跑完整一局（20 Turn）：
- ✅ **完整游戏循环到 Ending 成立**：触发 Normal End（Day 3），`run.status = completed`。
- ✅ 明日香的**ツンデレ 反应忠实**（"哈？你该不会是想说什么奇怪的话吧？" / "…总比一个人待着强"）。
- ❌ 场景+选项几乎全 fallback（🔴 #2）；NPC 反应约 50% 真实；记忆 0 条（真实反应未带 `memoryCandidates`）。

---

## 修复优先级建议

1. **🔴 #2 优先**：这是真实 LLM"AI 动态叙事"体验的当前最大瓶颈（场景+选项回退），改动集中在 validator/combined-generator。
2. **🔴 #3 次之**：Punishment/Meta 跨局闭环是设计核心循环的一环，需在计划中补排实现。
3. 🟠 随 Phase 11 仿真/真实 LLM 联调自然落地。
4. 🟢 随资源与部署推进。

> 触发本清单的审查对应：`phase5-review.md`（#1/#2 相关 Option 契约与多样性）、`phase6-review.md`（#4）、`phase11-review.md`（#5）、`phase10-review.md`（#6）、`phase12-review.md`（#7/#8）、`phase8-review.md`（#9）、`phase9-review.md`（#10）。
