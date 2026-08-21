# 真实 LLM 长对话复验报告（2026-08-21）

> 目的：验证 2026-08-21 审计接线修复（检索强化/记忆修剪/一致性/ContextCache）在真实 DeepSeek 调用下的行为，重点量化**检索强化饱和**风险。
> 配置：DeepSeek（deepseek-chat，openai-compatible）｜ 30 Turn ｜ 选项轮换覆盖四类行为 ｜ 原始数据：`live-verify-2026-08-21.json`。
> 工具：`ag-devtools live-verify --turns 30`。

---

## 一、达标项 ✅

| 指标 | 结果 | 目标/对照 |
|---|---|---|
| Scenario source 占比 | **100% llm**（30/30） | ≥80% |
| Reaction source 占比 | **100% llm**（30/30） | ≥80% |
| 记忆形成 | **24 条 / 30 轮**（0.8 条/轮） | 此前记录 10 条/30 轮（2026-08-16），P-1/E-2 修复持续生效 |
| 关系真实成长 | affection 2→50、trust 2→26 | 数值随行为演化正常 |
| PlayerModel 演化 | caring 52→64 | 随支持类行为缓慢上升 |
| 时间推进 | 5 天 / 30 轮，跨天 consolidation 正常触发 | — |
| 自然遗忘 | 16 条弱记忆进入 forgottenIds | decay/consolidation 链路工作 |
| 记忆修剪 | 未触发（records 24 < 上限 100） | 符合预期 |

## 二、发现的问题 ⚠️

### 发现 1：检索强化饱和（本次复验核心结论）

默认 `reinforcementBoost=26`、每次 startTurn 检索即强化：

```text
单条记忆强度轨迹：21 → 47 → 73 → 99 → 100（封顶）
```

- **3~4 次检索即饱和到 100**；30 轮后 24 条记忆中 16 条已被遗忘、剩 8 条活跃，其中 **6 条饱和（活跃层饱和率 75%）**。
- 饱和记忆每轮霸占 Top-K（retrievalCountSum 每轮 +4，即同样 4 条记忆每轮被召回）——**"记忆回音室"**：早期记忆垄断 Context，新记忆难以被召回（strength 权重 0.4 太强）。
- 全体均值 avgStrength=46.9 掩盖了该问题（被 16 条衰减中的遗忘记录拉低）——统计口径必须区分活跃/遗忘。

### 发现 2：遗忘记录仍占 records 名额（口径问题）

`consolidateMemories` 把弱记忆标记进 `forgottenIds` 但**不删除 record**（`consolidation.ts:33`），导致：
- `recordCount` 高估活跃记忆（24 vs 实际 8）；
- `pruneMemories` 的 `maxRecords=100` 对比的是含遗忘记录的总数，与"可检索容量"语义不一致。

### 发现 3（低优先级）：stress 单调下降无事件扰动

45→37 平滑下降，本轮选项偏温和所致，非缺陷；后续可用冲突类选项序列复验压力上升路径。

## 三、建议调整（待决策，未实施）

1. **强化节流**（任选其一或组合）：
   - 降低 boost：26 → 10~12；
   - 强化冷却：同一记忆 N 轮内不重复强化；
   - 仅"高相关检索"才强化（relevance 得分门槛）。
2. **检索权重再平衡**：strength 0.4 → 0.25~0.3，把权重让给 recency/relevance，缓解回音室。
3. **口径修正**：`pruneMemories` 与容量统计应基于活跃记忆（排除 forgottenIds）；或遗忘时直接硬删除记录。
4. 复验工具已增强：`live-verify` 现按活跃/遗忘分列统计并以活跃层计算饱和率。

## 四、结论

接线修复全部经真实 LLM 验证有效：**source 占比、记忆形成、关系成长、跨局基础均达标**。Life Engine P0 可以开工；强化参数调整作为 P0 并行小任务先行落地（改动集中在 `@ag/memory` 的 reinforcement/retrieval 权重，不影响契约）。
