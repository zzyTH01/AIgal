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

### 16. Beat System 文段拍视角契约缺失（人称/管辖权混乱）—— ✅ 已修复（2026-09-15 双 Agent 门面重构）
- **现象**：P0.5 文段拍生成器（beat-generator）为 #4 POV 修复后新增的生成路径，未继承视角契约——旁白以 NPC 第三人称限知视角直写角色内心（"她深吸一口气，试图将残梦压回记忆深处"，玩家不可能看到）；玩家动作与角色动作混写（文段拍写花瓣落在她的笔袋上，选项却是玩家把花瓣夹进笔记页）；文段拍→选择的场景状态断裂（她在教室门口→反应里在吃午饭）。
- **修复（双 Agent 门面 + 玩家第一人称）**：①生成端按管辖权重构为两个 Agent（`packages/narrative/src/agents/`，门面模式）——**玩家 Agent**（场景+选项，内部复用 combined-generator）以玩家第一人称「我」叙事，选项主语锚定玩家，禁写角色内心；**角色 Agent**（文段拍+反应+过渡，内部复用 beat/reaction/transition generator）注入视角契约——旁白以「我」的视角叙述角色可观察言行，内心只允许进 motive 字段（引擎留存），禁止描写玩家未做出的新行动；②两 Agent 从引擎共享状态各自分流上下文（玩家：场景/进度/多样性/一致性；角色：记忆/情绪/pending intent/motive 流）并各自校验输出；③fallback 文案同步修正（"主动走到「我」面前"）。
- **设计定案**：Master Design §11.11 叙事视角管辖权（v1.6）；#4 的"第二人称"约定由"玩家第一人称「我」"取代（galgame 主人公声音）。
- **真实 LLM 复验（2026-09-16，DeepSeek V4 Flash + thinking disabled，12 Turn/跨 3 天，记录 `dual-agent-pov-verify-playtest.md`）——四项 POV 指标全部通过**：
  - ①旁白第一人称「我」：全文 294 处，25/30 抽样拍以「我」视角开场（旧记录为 NPC 第三人称限知）。
  - ②角色内心零泄露：`她想起/她心想/她感到/她试图/她暗自` 全文 0 命中；内心只出现在 motive 行（28/28 拍）。
  - ③选项主语：全部为玩家（「我……」开头或祈使动词短语）。
  - ④生成质量：文段拍/选择拍/反应 **100% llm**（旧记录 95%）；stress 45→42 不归零；终局 affection 20/trust 11/活跃记忆 11 条。
- **遗留观察（非 POV 回归，待排期）**：
  - (a) 第 1 轮反应场景跳变：拍在走廊（09:30）而反应锚定事件模板场景（食堂午餐）——reaction 对拍的场景 grounding 不足，仅 1/12 轮出现；旧记录同类问题（门口→吃饭）对比，范围已大幅收窄。
  - (b) 拍间**台词级**近重复：第 1 轮三拍中两拍台词几乎相同（"早上好。你也是这所学校的学生吗/吧"）——现有相似度去重只覆盖 narration，不含 dialogues。

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

### 14. 检索强化饱和 + 遗忘口径问题 —— ✅ 已修复（2026-08-21 真实 LLM 复验）
- **现象**：默认 boost=26 使记忆 3~4 次检索即饱和到 100；30 轮后活跃记忆 75% 饱和，饱和记忆垄断 Top-K 形成"记忆回音室"（新记忆难进 Context）。详见 `live-verify-report-2026-08-21.md`。
- **修复**：boost 26→12 + 同记忆 1 天冷却；检索权重引入 recency .20 并下调静态属性；consolidation 晋升阈值 50→35（防活跃池枯竭）；prune 对遗忘记录排序降级但总量仍受约束。
- **复验**：30 轮后活跃记忆 11 条、0 饱和、最高强度 75.5，retrievalCountSum 106→26。对比数据见 `live-verify-report-2026-08-21.md` 第五节。

### 15. Beat System：拍间措辞复写 + stress 归零 —— ✅ 已修复（2026-09-10 第四轮 DeepSeek V4 Flash 复验全通过）
- **已修复（拍间复写）**：阈值 0.6→0.45 + 开头对开头比较（slice 60 对齐摘要长度）+ prompt 注入 [禁止复用的开头]/[续写起点]/[连续性] 指令。复验：相邻拍平均相似度 0.098→0.072，>0.45 的相邻对 3→1，且唯一残留对是收尾模板自身（已改三变体随机）。LLM 文段拍之间零重复。
- **思维链→扮演对象（新增机制）**：文段拍新增 `motive` 字段（角色内心动机），引擎留存回流 `flow.pendingTension` 驱动后续拍，作为 P1 Pending Intent 数据源；不呈现给玩家。真实对局覆盖率 47/47 且全部演化不重复。研究结论：不引入原始 CoT/reasoner 输出（成本/延迟/泄漏风险），以结构化 motive 承接其收益。
- **第三轮代码校准（2026-09-07）**：
  - ②stress 归零：`resolveSecondaryDelta` stress delta 限幅 ±1（此前 `intensity/10` 最高一次 -7，叠加 Beat 漂移 ±3 快速归零）。
  - ③节奏固定"3+1"：`GameRuntime.produceBeat` 未将 LLM `branchPotential` 传入 `FlowController.nextStep`（实际全部按 mid 处理）。已修复，现在 high 即刻出选择点、low 延迟，产生自然变奏。
  - ④fallback 率：`generateNarrativeBeats` 重试时注入 [校正] 指令（"上次因重复被拒绝"），引导 LLM 换场景切入，预期降低重复拦截→fallback 的比例。
  - 另：`DEFAULT_FLOW_BUDGET.similarityThreshold` 0.6→0.45 对齐第二轮校准定案（此前仅 Beat Generator 侧生效）。
  - **待真实 LLM 复验**：上述校准需 `ag-devtools live-play --turns 20` 确认 stress 不再归零、节奏出现变奏、fallback 率下降。
- **第四轮复验（2026-09-10，DeepSeek V4 Flash + thinking disabled）——三项指标全部通过，问题关闭**：
  - **适配层修复**：①`LLM_THINKING`/`LLM_REASONING_EFFORT` 环境变量支持（V4 Flash 默认 thinking=high 消耗 token 且忽略 temperature，游戏路径需 disabled）；②文段拍 `nextSuggestion` 枚举校准——V4 Flash 常写自由文本导致整拍 Zod 报废（占 fallback ~90%），按"LLM 建议、引擎裁决"原则降级为 undefined；③beat 情绪漂移范围修正——只作用于 `EmotionState`（valence/intensity/energy），不再作用于 psychology.stress（否则 59 拍系统性负向漂移必然排干 stress）；④prompt 示例 `emotionDrift` 由 `{"stress":-1}` 改为 `{"valence":1}`（消除负向引导）。
  - **复验指标**：文段拍 54%→**100% llm**；选择拍 95%；反应 100%；分支价值 high **22**/mid 29（节奏变奏成立）；stress 45→**43**（不再归零，仅 ±1 互动结算）；affection 42、trust 25、活跃记忆 12 条。对局记录 `v4flash-15-verify-playtest.md`。
  - 运行配置：`LLM_PROVIDER=openai-compatible LLM_MODEL=deepseek-v4-flash LLM_THINKING=disabled LLM_TIMEOUT_MS=60000`。

---

## 真实 LLM 联调验证记录（2026-08-16）

- **完整一局**（DeepSeek + 明日香，20 Turn）：✅ 触发 Normal End；场景/选项曾因多样性校验全回退（#2）。
- **#2 修复后**（10 Turn）：✅ 场景 100% llm、反应 100% llm、记忆 3 条。
- **长对话**（30 Turn / 跨 6 天）：✅ 场景 90% llm、反应 100% llm、记忆 10 条（每轮检索 0.7 条）、二次结算让 stress 65→74、PlayerModel 缓慢演化；❌ 但暴露 #4（POV 缺失）与 #5（记忆未注入）。

---

## 修复优先级建议（2026-09-16 更新）

> #1–#5、#14–#16 均已修复关闭；当前排序以 **Life Engine 主线（Event Life Plan P3–P5）** 为轴。

### 近期：P3 前置修复（#16 遗留观察，改动小，先于 P3 落地）

1. **🟠 拍间台词级去重（#16-观察b）**：相似度去重目前只覆盖 narration，不覆盖 dialogues——P3 Micro Events 会显著增加拍与台词密度，重复风险放大，须先行。
2. **🟠 反应场景 grounding（#16-观察a）**：reaction prompt 注入当前拍场景上下文（beatSummaries 尾部 + 当前日/时/地点），消除反应跳到事件模板场景（1/12 轮实测）。

### 主线：Life Engine（EVENT_LIFE_PLAN P3 → P4 → P5）

3. **P3 Micro Events**：三层事件（importance 字段已就绪），Micro 池 + 模板 + 生成，填充"生活感"。
4. **P4 Relationship Narrative State**：RelationshipState 增加 narrative 子结构（phase/impression/desire/unresolved/direction），P1/P2 意图管线直接消费。
5. **P5 Event Scheduler**：统一调度 Main/Side/Micro/Autonomous/Transition，动态权重（World+Character+Memory+Relationship+Intent），可复现。

### 部署层（主线后或并行）

6. **#12 HTTP Application API**（`POST /turn/choice` 形态）。
7. **#11 PNG 卡导入 + 真实 SillyTavern 联调**。
8. **#9/#10 真实立绘/音频资源接入**（Player 当前 CSS 占位）。

### 低优先级（随资源）

9. **#6** 记忆/平衡参数校准；**#7** 真实 token 成本计量；**#8** 设计器编辑器扩展；**#13** prune 语义升级（硬删除→遗忘）。

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
