# 已知问题清单（Known Issues）

> 记录时间：2026-08-16 ｜ 审查侧汇总：目前仓库中**已确认的问题**与**待办项**。
> 按严重度排列。🔴 高优先级（影响核心体验）／🟠 应修（影响完整性）／🟢 低优先级（随资源/部署覆盖）。

---

## 🔴 高优先级

### 1. `optionConditionsSchema` 过严导致真实 LLM 高概率回退 —— ✅ 已修复（2026-08-16）
- 修复：`@ag/schemas` 新增 LLM 侧宽松 schema；`renderOption` 用 `sanitizeOptionConditions` 清洗；prompt 约束 conditions 形状。测试覆盖通过。

### 2. 多样性校验瓶颈 —— ✅ 已修复（Completion Plan Phase C，2026-08-16）
- 修复：`validateOptions` 新增 `diversityMode: 'soft'`（LLM 选项缺类仅记录 warning，不回退整份）；`combined-generator` 用 soft + maxTokens 1536。
- 真实 LLM 复跑验证：**场景 90–100% llm、反应 100% llm**。

### 3. Bad End → Punishment → Meta Progression → New Run 跨局引擎 —— ✅ 已实现（Completion Plan Phase B）
- 实现：`meta-progression.ts`（applyBadEndPunishment / startNewRunFromMeta）+ `GameRuntime.endRun/setPermanentModifier/startNewRun`。测试通过。

### 4. POV / 角色定位缺失 —— ✅ 已修复（2026-08-16）
- 位置：`packages/narrative/src/combined-generator.ts`（`buildCombinedRequest` prompt 未确立角色关系）
- **现象**：真实 LLM 把"你"写成**明日香本人**——场景以明日香第一人称叙述（"你坐在NERV宿舍的床边…"），生成的选项是**明日香对真嗣的动作**（"冲去真嗣的住处把他拽出来"、"找真嗣挑战"），而非**玩家对明日香的互动**。
- **影响**：核心交互（玩家↔NPC）失效——叙事漂移到明日香与第三方角色，选项不合逻辑，**关系数值几乎不动**（30 Turn 后 affection=6 / trust=0）。
- **修复方向**：prompt 明确角色定位——"你是【玩家】，明日香是你正在互动的角色；用第二人称描写玩家眼前的场景；玩家可选的行动对象是明日香"，并给正例。

---

## 🟠 应修 / 待排期

### 5. 检索到的记忆未注入 LLM prompt —— ✅ 已修复（2026-08-16）
- 位置：`packages/narrative/src/combined-generator.ts` / `reaction-generator.ts`（`build*Request` 只注入 `systemRules`）
- **现象**：`buildContext` 每轮检索出 0.7 条记忆进 `ModelContext`，但生成 prompt **不含 `retrievedMemories`**（也不含 recentEvents / currentEvent / internalState）。
- **影响**：明日香的文本**从不引用过去的事** → V1 成功标准"角色真的记得你"（E-5）仍无法在对话中体现。
- **修复方向**：在 combined / reaction prompt 中加入 `[检索记忆]` 段（复用 `modelContextToRequest` 的记忆/事件行），并说明"若记忆与本轮相关，在言行中自然呼应"。

### 6. Memory / 平衡参数为经验值，未校准
- `formMemory` 初始 strength、阈值；重复反馈转负轮次。已记 `TODO(Phase 11)`。

### 7. 成本估算为启发式
- `simulation-engine.ts` 用 `turns×1200/400` token 估算；已标 `TODO(真实 LLM)`，接入 `usageListener` 后替换。

### 8. 设计器为最小版
- World Builder / Parameter / Event / OptionTemplate / Ending 编辑器未实现（schema 已就绪）；已增强（地点/进度/事件/Ending 标题）。

---

## 🟢 低优先级（随资源接入 / 部署覆盖）

### 9. 立绘/背景为 CSS 占位
- 真实资源应从 `GameProject.assets`（schema 已就绪）接入；`CharacterPortrait` 已带情绪。

### 10. TTS / BGM / SE 为 disabled 占位
- 符合 V1"全语音暂不作核心"。

### 11. PNG 元数据卡嵌入 / 真实 SillyTavern 实例联调未做
- `@ag/st-adapter` 提供 JSON Card 编解码与 Extension 协议，但"加载进运行中的 ST / PNG 卡"是部署层工作。

### 12. Application API 为进程内调用
- 设计 §5.4 为 `POST /turn/choice` HTTP 形态；当前为程序化 API，HTTP 包装留待部署。

### 13. `pruneMemories` 为硬删除修剪
- 超容量记忆直接删除，不进 `forgottenIds`（语义"修剪"≠"遗忘"）。
- **2026-08-21 更新**：修剪本身仍为硬删除语义，但已从"仅 devtools"接入 `GameRuntime.chooseOption` 主路径（`memoryPruneLimit` 可配，默认 100），主游玩路径记忆无限增长风险消除。

### 14. 检索强化饱和 + 遗忘口径问题 —— 🆕 2026-08-21 真实 LLM 复验发现
- **现象**：默认 boost=26 使记忆 3~4 次检索即饱和到 100；30 轮后活跃记忆 75% 饱和，饱和记忆垄断 Top-K 形成"记忆回音室"（新记忆难进 Context）。详见 `live-verify-report-2026-08-21.md`。
- **口径**：`forgottenIds` 记录不删除 record，容量统计与 prune 上限被遗忘记录稀释。
- **修复方向**：boost 降至 10~12 或加强化冷却/相关性门槛；检索权重 strength 0.4→0.25~0.3；prune 与统计改为按活跃记忆计算。

---

## 真实 LLM 联调验证记录（2026-08-16）

- **完整一局**（DeepSeek + 明日香，20 Turn）：✅ 触发 Normal End；场景/选项曾因多样性校验全回退（#2）。
- **#2 修复后**（10 Turn）：✅ 场景 100% llm、反应 100% llm、记忆 3 条。
- **长对话**（30 Turn / 跨 6 天）：✅ 场景 90% llm、反应 100% llm、记忆 10 条（每轮检索 0.7 条）、二次结算让 stress 65→74、PlayerModel 缓慢演化；❌ 但暴露 #4（POV 缺失）与 #5（记忆未注入）。

---

## 修复优先级建议

1. **🔴 #4 最优先**：POV/角色定位是核心交互的根基，改动小（prompt 补一句角色定位），修后玩家↔明日香的互动才成立。
2. **🟠 #5 次之**：注入检索记忆，"角色真的记得你"（E-5）才有演示可能。
3. 其余随资源/部署推进。

> 触发本清单的审查对应：`phase5-review.md`（#1/#2 相关 Option 契约与多样性）、`phase6-review.md`（#6）、`phase11-review.md`（#7）、`phase10-review.md`（#8）、`phase12-review.md`（#9/#10）、`phase8-review.md`（#11）、`phase9-review.md`（#12）；#3/#4/#5 来自本轮 Completion Plan 与长对话实测。


## ✅ 修订记录（2026-08-16 第二轮）

- **#4 POV/角色定位**：`combined-generator` prompt 新增【角色定位】段——“你是玩家，正在与「NPC」互动；场景用第二人称描写玩家眼前所见；选项是玩家对 NPC 的行动”；`reaction-generator` 新增“你现在扮演「NPC」，回应玩家；不要替玩家说话”。
- **#5 检索记忆注入**：combined / reaction prompt 均注入 `[检索记忆N]`、`[当前事件]`、`[近期事件]`，并要求相关时自然呼应。
- 新增测试：断言 prompt 包含玩家 POV、NPC 名、检索记忆内容。

## ✅ 修订记录（2026-08-21 审计接线修复）

> 详见 `doc-vs-impl-audit-2026-08-21.md`。此前"实现未接线"的组件已接入生产路径：

- `ContextCache` 接入 `GameRuntime.startTurn`（stable summary 进 system prompt，hit/miss 经 `getContextCacheStats()` 可观测）。
- 检索强化 `reinforceMemoryRecord` 接入 startTurn（Retrieval→Reinforcement 设计语义落地）。
- `pruneMemories` 接入 chooseOption 主路径（#13 风险消除）。
- 一致性规则 `RuntimeConfig.consistency` 注入 Scenario+Reaction（含此前完全绕过校验的合并生成器路径）。
- `llmMaxAttempts` 可配置（原写死 1）。
- 回归：`pnpm --filter @ag/narrative test` 20/20 通过。
