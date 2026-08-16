# 已知问题清单（Known Issues）

> 记录时间：2026-08-16 ｜ 审查侧汇总：目前仓库中**已确认的问题**与**待办项**。
> 按严重度排列。🔴 高优先级（影响核心体验）／🟠 应修（影响完整性）／🟢 低优先级（随资源/部署覆盖）。

---

## 🔴 高优先级 —— 真实 LLM 联调阻断体验（本轮真实运行新发现）

### 1. `optionConditionsSchema` 过严，导致真实 LLM 合并生成高概率回退
- 位置：`packages/schemas/src/option.ts:4-9,42`（`optionConditionValueSchema` 联合 + `optionConditionsSchema`）；`packages/narrative/src/combined-generator.ts`（prompt 未约束 `conditions` 形状）
- **现象**（用 DeepSeek 真实跑 3 Turn + 探针复现）：
  - DeepSeek 返回**合法 JSON**（scenario + 4 选项完整，`JSON.parse` 通过）；
  - 但 `parseStructuredResponse` 报 `options.3.conditions.requires: Invalid input`——LLM 生成的某选项 `conditions` 值（数组 / `null` / 带额外键如 `{requires: ...}`）不在联合类型 `boolean|number|string|{min,max}` 内；
  - `.strict()` + 联合校验**拒绝整份响应** → Retry → 回退确定性选项。
- **实测影响**：场景+选项**每轮都 fallback**（机械文本"approach / support"），NPC 反应约 **2/3 fallback**（"……（NPC 没有回应。）"）——真实 LLM 的动态叙事/选项体验失效。
- **但路径本身可工作**：探针第二次调用 `source: llm`，输出流畅自然语言（"走过去坐在Mio身边，轻轻问她相册里有什么故事"）——证明是校验脆性，非集成失败。
- **修复建议**（择一或组合）：
  - **A**：`plannedOptionSchema`（LLM 侧）的 `conditions` 放宽——联合加 `z.array(z.string())` / `z.null()`，或 `.passthrough()`；只在最终 `optionSchema`（入库）用严格版；
  - **B**：prompt 显式约束 `conditions` 只允许 `{}` 或 `{"<flag>": bool|number|"字符串"}`，并给正例；
  - **C**：解析前宽容处理——过滤/剥离不合规的 `conditions` 键。
- **验证**：修后复跑真实 LLM 一轮，确认 scenario/options/reaction 均 `source: llm`。

---

## 🟠 应修 / 待排期（既有 review 标记的 TODO）

### 2. Memory / 平衡参数为经验值，未校准
- `formMemory` 初始 strength、阈值（`formation.ts:60,78`）；重复反馈转负轮次（`state-resolver.ts`）。
- 已记 `TODO(Phase 11)` 与 DEVELOPMENT_PLAN 校准任务；需用 100 Runs 仿真校准。

### 3. 成本估算为启发式
- `simulation-engine.ts` 用 `turns×1200/400` token 估算，非真实用量。
- 已标 `TODO(真实 LLM)`；接入 `usageListener` 后替换。

### 4. 设计器为最小版
- World Builder / Parameter / Event / OptionTemplate / Ending 编辑器未实现（schema 已就绪），`apps/designer` 仅 ProjectForm。
- 交付口径已在 DEVELOPMENT_PLAN §13 注明"最小设计器"。

---

## 🟢 低优先级（随资源接入 / 部署覆盖）

### 5. 立绘/背景为 CSS 占位
- 真实资源应从 `GameProject.assets`（schema 已就绪）接入；`CharacterPortrait` 已带情绪，可作"情绪换立绘"挂点。

### 6. TTS / BGM / SE 为 disabled 占位
- 符合 V1"全语音暂不作核心"；接入时在 `AudioPanel` 接线。

### 7. PNG 元数据卡嵌入 / 真实 SillyTavern 实例联调未做
- `@ag/st-adapter` 提供 JSON Card 编解码与 Extension 协议，但"加载进运行中的 ST / PNG 卡"是部署层工作。

### 8. Application API 为进程内调用
- 设计 §5.4 为 `POST /turn/choice` HTTP 形态；当前 `ApplicationApi` 是程序化 API，HTTP 包装留待部署。

### 9. `pruneMemories` 为硬删除修剪
- 超容量记忆直接删除，不进 `forgottenIds`（语义"修剪"≠"遗忘"）；已 JSDoc 标注，如需"遗忘"语义再调。

---

## 修复优先级建议

1. **🔴 #1 优先**：这是真实 LLM 体验的当前最大瓶颈，改动小（schemas + prompt 或宽容解析），修后即恢复"AI 动态叙事"。
2. 🟠 #2/#3 随 Phase 11 仿真/真实 LLM 联调自然落地。
3. 🟢 随资源与部署推进。

> 触发本清单的审查对应：`docs/review/phase5-review.md`（#1 相关 Option 契约）、`phase6-review.md`（#2）、`phase11-review.md`（#3）、`phase10-review.md`（#4）、`phase12-review.md`（#5/#6）、`phase8-review.md`（#7）、`phase9-review.md`（#8）。


---

## ✅ 修订记录（实现侧，2026-08-16）

### 🔴 #1 已修复：真实 LLM 合并生成条件过严
- `@ag/schemas` 新增 LLM 侧宽松条件 schema：`llmOptionConditionValueSchema / llmOptionConditionsSchema`（允许 array/null/带额外键的对象）。
- `@ag/option`：`renderOption` 通过 `sanitizeOptionConditions` 把宽松条件清洗为最终严格 `OptionConditions`（只保留标量或 `{min,max}`）。
- `@ag/narrative`：`plannedOptionSchema` 改用宽松 schema；Scenario+Options 与 OptionPlanner prompt 显式约束 conditions 形状。
- 新增测试：带 `{requires:[...]}`、`null`、`{min, extra}` 的 LLM 输出不再触发 fallback，清洗后仍 `source: llm`。

### 🟠 #2 记忆/平衡参数
- 保留 Phase 11 仿真校准基线：100 runs → normal 100%、avgDay 5 / avgTurn 40、avgMemoryRecords 16、avgContextMemories 3。参数后续随真实 LLM 联调再校准。

### 🟠 #3 成本启发式
- 保留 `TODO(真实 LLM)`，接入 usageListener 后替换。

### 🟠 #4 最小设计器已增强
- `apps/designer` 表单新增：地点名、每日进度上限、事件标题、Ending 标题；构建 Project 时生成对应 world location / parameters / event / ending。OptionTemplate 仍待后续编辑器。

### 🟢 #5–#9
- 立绘/背景、音频、PNG 卡、HTTP 包装、prune 语义：维持 V1 占位/部署边界，已记录，不阻塞。
