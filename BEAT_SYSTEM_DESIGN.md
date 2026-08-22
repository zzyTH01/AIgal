# Beat System 设计文档 —— 事件内连续叙事流（P0.5）

> 版本：v1.1（2026-08-22）｜ 上位依据：`AI_GALGAME_Master_Design_v1.0.md` §11（v1.5 §11.11 定案）、`EVENT_LIFE_PLAN.md` P0.5
> 决策记录：D1–D7 全部按推荐执行（见 §9）；新增**事件重要性权重**与**双推进模式**为用户定案。
> 变更记录：v1.1 校准（known-issues #15）——相似度阈值 0.6→**0.45**、去重改为**开头对开头**比较、prompt 注入 `[禁止复用的开头描写]/[续写起点]`；新增 **motive 字段**（思维链→扮演对象，回流 `flow.pendingTension`，P1 数据源）；收尾模板三变体。
>
> 本文是 P0.5 的唯一实现依据：设计理念 + 数据契约 + 接口/类 + 开发计划。实现状态：T1–T8 ✅（验收见 `docs/review/beat-system-report-2026-08-22.md`）。

---

# 1. 设计理念

## 1.1 问题诊断（现状）

P0 之后事件间有了过渡，但事件内部仍是"回合制问答"：

- 每 Turn 固定输出"过渡+情景+4 选项"，**每轮必选**，机械感强；
- 过渡只有一段，且与情景/选项同源生成 → **内容重合**（过场把选项要做的事提前写掉）;
- 上下文只有一段，选项缺乏"本事件前文"的土壤。

## 1.2 目标模型

```text
当前：  事件 → [过渡+情景+选项] → 选择 → 反应 → 事件 → 下一个事件
目标：  事件 → 选择 → 文段 → 文段 → 选择 → 文段 → … → 事件结束
              └── 选项影响文段，文段积累为下一选项的土壤 ──┘
```

三命题：

1. **事件内部是连续叙事流**：一个选择引出若干文段，直到下一个选择点或事件结束；
2. **节奏由引擎裁决**：下一拍是文段还是选项，由确定性标准判断（预算/间隔/分支价值）；LLM 只可建议；
3. **事件间只靠记忆传递**：事件收束为 summary 记忆入库，零新通道。

## 1.3 职责边界不变（Master Design §3 铁律）

| LLM 负责                                                             | 引擎负责                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| 文段内容（旁白/对话）、`branchPotential` 建议、`nextSuggestion` 建议 | 拍类型裁决、预算与间隔约束、相似度去重、结算与 Rollback |

---

# 2. 核心模型

## 2.1 两类拍（Beat）

|          | NarrativeBeat                                        | ChoiceBeat                      |
| -------- | ---------------------------------------------------- | ------------------------------- |
| 内容     | 旁白 + 对话：余波、环境/时间流动、记忆回味、张力铺垫 | 极简引子 + 2–4 个选项           |
| 数值     | 仅轻量情绪漂移（±1~3，clamp）                        | 正常走 StateResolver 全链路结算 |
| 玩家输入 | 无（▼ 继续 / 自动连播）                              | 必须选择                        |
| 输出契约 | 无 options 字段（结构上不可能预支选项）              | 无长旁白字段                    |

## 2.2 事件重要性权重（importance）

`EventDefinition` 新增 `importance: 'main' | 'side' | 'micro'`（与 P3 Micro Events 的 level 字段统一，提前落地契约）。重要性同时决定**预算**与**数值放大**：

| importance | maxBeats | maxChoices | 数值影响系数 impactScale |
| ---------- | -------- | ---------- | ------------------------ |
| main       | 8–12     | 2–4        | ×1.25                    |
| side       | 5–6      | 1–2        | ×1.0                     |
| micro      | 2–3      | 0–1        | ×0.75                    |

- 预算可在 `RuntimeConfig.flowBudget` 全局覆盖默认表（D3：全局默认 + 事件定义未来可覆盖单事件）。
- impactScale 在 StateResolver 结算出口对关系/心理 final delta 统一乘算（clamp 后写入），重要事件的每个选择"更重"。

## 2.3 FlowController（节奏控制器，纯确定性）

```text
nextStep(flow) =
  end        若事件目标达成 ∨ 张力已解决标记 ∨ beatsUsed ≥ maxBeats
  choice     若 choicesUsed < maxChoices ∧ beatsSinceLastChoice ≥ minGap ∧ 分支价值高
             （分支价值 = LLM 建议的 branchPotential=high ∨ 引擎信号：冲突未消/阈值临近/risk 待发酵）
  narrative  否则
```

- `minGap` 默认 2（两个选择点之间至少 2 个文段拍）——直接治"每轮都选"。
- 预算耗尽的强制收束优先级高于一切建议；`branchPotential` 只是参考信号之一。
- 所有阈值进入 `FlowBudget` 配置，经 devtools 仿真离线校准（D6，同记忆 #14 方法论）。

## 2.4 双向因果：事件内滚动上下文

```text
EventFlow = { eventId, importance, 预算余量, beatSummaries[]（每拍压缩 1–2 句）,
              pendingTension, lastChoiceResolution }
```

- 生成 NarrativeBeat 注入：lastChoiceResolution + Top-K 检索记忆 + 时间/地点变化；
- 生成 ChoiceBeat 注入：**beatSummaries 全量**——文段说过的话成为选项的土壤；
- 这把"选项之间的上下文"从固定 1 段升级为整个事件流。

## 2.5 去重（治"文段与选项重合"）

三层防线：

1. **prompt 职责切分**：文段只准写余波/环境/回味，禁止出现任何可选行动的描写；
2. **契约互斥**：NarrativeBeat schema 无 options 字段，选项仅由 ChoiceBeat 通道产生；
3. **相似度校验**：复用中文 bigram 相似度，narration 与任一候选选项文本相似度 > 0.6 → 触发 retry→fallback（接入 consistency-check 链路）。

## 2.6 双推进模式（用户定案）

| 模式   | 行为                                                                       |
| ------ | -------------------------------------------------------------------------- |
| manual | 每个 NarrativeBeat 停在"▼ 继续"，点击推进                                  |
| auto   | 文段连播（打字机完成后自动 advance），**遇 ChoiceBeat 必停**（两模式一致） |

切换开关在 UI；Runtime 不感知模式差异（advance 语义相同，调用频率由前端决定）。

## 2.7 事务与存档（D1）

- **Beat 即时展示不入档**：文段拍只在内存与回放日志中存在；
- **Choice 区间原子提交**：从一次选择到下一次选择点之前的所有拍，在下一次 `chooseOption` 时随 TurnResult 一并原子提交；中途退出读档回到上一个选择点——符合 GAL 存档习惯，保住 Turn 事务语义与 Rollback。

---

# 3. 数据契约（@ag/schemas，新文件 `src/beat.ts`）

```typescript
export const beatKindSchema = z.enum(['narrative', 'choice']);

/** 分支价值：LLM 建议，引擎裁决。 */
export const branchPotentialSchema = z.enum(['high', 'mid', 'low']);
export const nextStepSuggestionSchema = z.enum(['choice', 'beat', 'end']);

export const narrativeBeatSchema = z.object({
  beatId: idSchema,
  kind: z.literal('narrative'),
  narration: z.string().min(1),
  dialogues: z.array(transitionDialogueSchema),
  source: sourceEnum,                                    // 'llm' | 'fallback'
  branchPotential: branchPotentialSchema.default('mid'),
  nextSuggestion: nextStepSuggestionSchema.optional(),   // 仅建议
  /** 轻量情绪漂移（D4）：{ metric: delta }，引擎 clamp ±3。 */
  emotionDrift: z.record(z.string(), z.number()).optional(),
  /** 思维链→扮演对象（v1.1）：角色内心动机，引擎留存回流 pendingTension，不呈现给玩家（P1 数据源）。 */
  motive: z.string().max(200).optional(),
}).strict();

export const choiceBeatSchema = z.object({
  beatId: idSchema,
  kind: z.literal('choice'),
  intro: z.string().max(120).optional(),                 // 极简引子，禁止长旁白
  options: z.array(optionSchema).min(2).max(4),
  source: sourceEnum,
}).strict();

export const beatSchema = z.discriminatedUnion('kind', [narrativeBeatSchema, choiceBeatSchema]);
export type Beat = z.infer<typeof beatSchema>;

/** 事件流状态（runtime 内态；随存档持久化以便恢复到选择点）。 */
export const eventFlowSchema = z.object({
  eventId: idSchema.nullable(),
  importance: z.enum(['main', 'side', 'micro']).default('side'),
  beatsUsed: z.number().int().nonnegative(),
  maxBeats: z.number().int().positive(),
  choicesUsed: z.number().int().nonnegative(),
  maxChoices: z.number().int().nonnegative(),
  beatsSinceLastChoice: z.number().int().nonnegative(),
  status: z.enum(['flowing', 'awaiting-choice', 'ended']),
  beatSummaries: z.array(z.string()),
  pendingTension: z.string().optional(),
}).strict();

/** TurnResult 扩展：本次选择区间内产生的拍序列（旧档兼容 optional）。 */
turnResultSchema: { …, beats: z.array(beatSchema).optional() }

/** EventDefinition 扩展。 */
eventDefinitionSchema: { …, importance: z.enum(['main','side','micro']).default('side') }
```

# 4. 接口与类

## 4.1 FlowController（@ag/core，纯函数式即可）

```typescript
export interface FlowBudget {
  minBeatsBetweenChoices: number; // 默认 2
  defaults: Record<'main' | 'side' | 'micro', { maxBeats: Range; maxChoices: Range }>;
  similarityThreshold: number; // 默认 0.6
}

export class FlowController {
  constructor(budget: FlowBudget);
  openFlow(eventId, importance, seedRandom?): EventFlow;
  nextStep(
    flow: EventFlow,
    signals: { branchPotential?: BranchPotential; tensionResolved?: boolean },
  ): 'narrative' | 'choice' | 'end';
  registerBeat(flow: EventFlow, beat: Beat, summary: string): EventFlow;
}

/** 中文 bigram 相似度（复用 @ag/memory tokenize）。 */
export function textSimilarity(a: string, b: string): number;
```

## 4.2 Narrative 层（@ag/narrative）

```typescript
export interface BeatContextInput extends TransitionContextInput {
  flow: Pick<EventFlow, 'beatsUsed' | 'choicesUsed' | 'beatSummaries' | 'pendingTension'>;
  /** Choice 区间结算摘要（首个文段拍必带）。 */
  lastChoiceResolution?: string;
}

/** 文段拍：1 次调用可返回 1–2 拍（D5 成本策略）。 */
export async function generateNarrativeBeats(
  input: BeatContextInput,
  gateway,
  options?: { maxBeats?: 1 | 2 } & TransitionGeneratorOptions,
): Promise<(NarrativeBeat & { source })[]>;

export function fallbackNarrativeBeat(input: BeatContextInput): NarrativeBeat;

/** 选择拍：引子 + 选项（复用现 combined 的场景+选项能力，剥离过渡职责）。 */
export async function generateChoiceBeat(
  input: BeatContextInput,
  gateway,
  options?: CombinedGeneratorOptions,
): Promise<ChoiceBeat & { scenario: GeneratedScenario }>;
```

Prompt 职责切分写死：文段 prompt 明示"只写余波/环境/回味；**禁止描写任何玩家可选的行动**"；返回 JSON 含 `branchPotential/nextSuggestion/emotionDrift/motive`。校准（v1.1）追加：`[禁止复用的开头描写]`/`[续写起点]` 注入与 [连续性]/[思维链] 指令；拍间去重为**开头对开头**比较（阈值 0.45）。

## 4.3 Runtime（@ag/runtime/game-runtime.ts）

```typescript
export type FlowPhase = 'awaiting-advance' | 'awaiting-choice';

GameRuntime 新增：
  private flow?: EventFlow;
  private pendingBeats: Beat[] = [];          // 未提交拍缓冲
  private flowPhase: FlowPhase;

  /** 推进下一拍（仅 awaiting-advance 合法）。返回最新一拍与视图。 */
  async advance(): Promise<AdvanceView>;
  // AdvanceView { turnId, beat: Beat, flowPhase, flow: EventFlow, transition?, state }

  // chooseOption：仅 flowPhase === 'awaiting-choice' 合法（否则抛错）；
  //   提交时将 pendingBeats 写入 TurnResult.beats 并清空缓冲。
  getFlowState(): EventFlow | undefined;

startTurn() 变化：
  openFlow(selectedEvent) → FlowController.nextStep 决定首拍类型 →
    'choice'  → generateChoiceBeat → awaiting-choice（兼容旧 UI：无 advance 也可直接选）
    'narrative' → generateNarrativeBeats(1) → awaiting-advance
```

impactScale 接线：chooseOption 内 `transaction.resolveChoice(option, { rng, impactMultiplier: scale(importance) })`；core `ResolveChoiceOptions` 增加 `impactMultiplier?: number`（default 1），StateResolver 出口统一乘算并 clamp。

## 4.4 UI（apps/player）

- `FlowControls.tsx`：`▼ 继续` 按钮 + `自动连播` toggle；
- App 按 `flowPhase` 切换：awaiting-advance → 渲染拍文本（打字机）+ 控件；auto 模式在 Typewriter onDone 后自动调 advance；awaiting-choice → OptionList；
- 事件结束时显示事件收束提示，随后进入下一事件 startTurn。

## 4.5 devtools

- live-play：按拍输出（`【文段】/【选择点】` 前缀），统计 beatsPerEvent / choicesPerEvent / 重合率（去重触发次数）；
- live-verify：summary 增加 flow 维度指标；
- simulate：接入 FlowController 校准脚本（100 Runs 扫 budget 参数）。

---

# 5. 兼容性影响

| 面              | 影响                              | 对策                                              |
| --------------- | --------------------------------- | ------------------------------------------------- |
| 旧档            | 无 flow/beats 字段                | optional + load 时 openFlow(side, 默认预算) 兜底  |
| 旧测试          | chooseOption 在无 flow 时仍需可用 | flow 缺省视为 awaiting-choice（向后兼容路径保留） |
| Golden/simulate | 指纹变化                          | 同 seed 自比较不受影响；基线重采一次              |
| P3 关系         | level 字段提前落地                | P3 任务改为复用 importance，不再重复定义          |

# 6. 验收标准（P0.5 完成的定义）

1. 事件内出现"选择 → ≥2 文段 → 选择"的连续流；不再每轮必有选项；
2. FlowController 预算生效：main 事件拍数显著多于 micro；超预算强制收束；
3. 文段/选项去重生效：相似度触发 retry 有测试覆盖；人工抽查无明显重合；
4. beatSummaries 进入 ChoiceBeat prompt（自动化断言）；
5. 双推进模式可用：manual ▼ 与 auto 连播均到选项必停；
6. impactScale 生效：同选项在 main/micro 事件中 delta 放大/缩小有断言；
7. 事件结束产出 summary 记忆并可被后续事件检索引用；
8. 真实 LLM 对局（live-play ≥20 Turn）：文段 llm 占比 ≥80%、无每轮双选项、记录文档供检查。

# 7. 开发计划（T1–T8）

| 步骤 | 内容                                                                                 | 测试                                          |
| ---- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| T1   | schemas：beat/eventFlow/TurnResult.beats/EventDefinition.importance                  | parse/round-trip/旧档兼容                     |
| T2   | core：FlowController + textSimilarity + impactMultiplier 接线                        | 预算/间隔/强制收束/白名单过滤/放大系数        |
| T3   | narrative：generateNarrativeBeats + fallback + 去重校验                              | fixture 解析/retry/fallback/相似度触发        |
| T4   | narrative：generateChoiceBeat（combined 能力迁移，剥离过渡）                         | 引子长度限制/选项数/与文段职责互斥            |
| T5   | runtime：flow 状态机 + advance()/chooseOption 门禁 + pendingBeats 提交 + impactScale | 全链路：流推进/非法调用抛错/存档往返/区间提交 |
| T6   | player：FlowControls + 双推进模式                                                    | 渲染/auto 到选项停止/jsdom                    |
| T7   | devtools：live-play/live-verify/simulate 校准                                        | 指标输出/参数扫描报告                         |
| T8   | 真实 LLM 验收：live-play ≥20 Turn 对照 §6 八条                                       | 报告落 docs/review/                           |

依赖链：T1 → T2 → (T3,T4) → T5 → (T6,T7) → T8。每步全仓回归后再进下一步。

# 8. 风险

- **成本**：D5 打平后每事件调用数 ≈ 旧模型 ×1.5，观察后必要时把 narrative 拍 batch 提升到 2；
- **节奏失衡**：minGap/预算初值靠 T7 校准，允许第一版偏保守（多文段少选项）；
- **LLM 违规预支选项**：靠三层防线 + fallback 兜底，真实对局持续抽查。
