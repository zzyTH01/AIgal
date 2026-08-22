# Beat System（P0.5）验收报告（2026-08-22）

> 依据：`BEAT_SYSTEM_DESIGN.md` §6 八条标准 + T1–T8 开发计划。
> 真实验证：DeepSeek（deepseek-chat）20 Turn，对局记录 `../../beat-system-playtest.md`。

## 一、实施清单（T1–T8 ✅）

| 步骤 | 内容 | 落点 |
|---|---|---|
| T1 | beat 四契约 + `TurnResult.beats?` + `EventDefinition.importance` | `@ag/schemas/src/beat.ts` |
| T2 | FlowController（openFlow/nextStep/registerBeat）+ textSimilarity + impactMultiplier | `@ag/core/flow-controller.ts`、`state-resolver.ts` |
| T3 | generateNarrativeBeats（批量 1–2 拍）+ fallback + 三层去重 | `@ag/narrative/beat-generator.ts` |
| T4 | generateChoiceBeat（引子≤160 + 选项，与选项重合即 retry→fallback） | 同上 |
| T5 | runtime 流状态机：prepareTurnContext / produceBeat / advance() / chooseOption 门禁 / pendingBeats 区间提交 / 情绪漂移 clamp±3 / 事件滚动衔接 | `@ag/runtime/game-runtime.ts` |
| T6 | Player：FlowControls（▼ 继续 / 自动连播）+ 拍渲染 + 选择点必停 | `apps/player` |
| T7 | live-play / live-verify 拍维度指标；live-play Markdown 重构为拍结构 | `apps/devtools` |
| T8 | 真实 LLM 验收（本报告） | — |

回归：build ✅ / **277 tests** ✅ / typecheck ✅ / lint ✅。

## 二、八条验收标准对照

| # | 标准 | 结果 |
|---|---|---|
| 1 | 连续流"选择 → ≥2 文段 → 选择" | ✅ 实测每轮 3 文段 + 1 选择点，事件内连续推进 |
| 2 | 预算生效：main 多于 micro；耗尽强制收束 | ✅ main 8–12 拍 / micro 2–3 拍；收束拍后自动滚动新事件 |
| 3 | 去重生效 + 人工无明显重合 | ⚠️ 部分：拍间相似度触发 retry 生效（llm 83%），但**同事件内场景措辞仍有复写**（见遗留） |
| 4 | beatSummaries 进入选择点 prompt | ✅ `[本事件已发生]` 注入并有测试断言 |
| 5 | 双推进模式可用，到选项必停 | ✅ jsdom 测试覆盖 manual/auto 两模式 |
| 6 | impactScale 生效 | ✅ main ×1.25 / micro ×0.75 断言通过 |
| 7 | 事件 summary 记忆可被检索引用 | ✅ beatSummaries/记忆联动链路测试通过 |
| 8 | 真实 LLM ≥20 Turn：文段 llm ≥80%、无双选项 | ✅ 文段拍 **83%**（60 拍）/ 选择拍 100% / 反应 95%；affection 35、trust 28 |

## 三、真实对局指标

- 20 Turn / 跨 4 天 / 文段拍 60 个（83% llm）/ 选择点 20 个（100% llm）
- 终局 affection 35、trust 28、活跃记忆 10 条
- 每轮固定 3 文段 + 1 选择点——FlowController minGap=2 与 mid 分支价值的组合使节奏略趋固定，属预期保守行为（D6 离线校准待做）

## 四、遗留问题（known-issues #15）

1. **拍间措辞复写**：同一事件内相邻文段的开头场景描写仍高度相似（paraphrase 级重复，bigram 相似度未达 0.6 阈值）。修复方向：①阈值下调至 ~0.45 或改用逐句级比较；②prompt 强化"禁止复用此前开头描写"；③在 beatSummaries 中携带上一拍开头句供比对。
2. **stress 归零**：情绪漂移与二次结算叠加使 stress 快速衰减，需在 #6 校准任务中一并复核。
3. 节奏固定为"3+1"：引入 branchPotential=high 的真实分布后应出现变节奏；依赖 prompt 对分支价值的引导校准。
