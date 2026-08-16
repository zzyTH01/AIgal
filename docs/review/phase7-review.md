# Phase 7 LLM Gateway 落地 —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`c5cf970`（Phase 7 LLM Gateway）
> 结论：**无阻断项、无应修项，Phase 7 通过，可进入 Phase 8（SillyTavern Adapter）。**
> 以下建议均为可选项，可随 Phase 9 / 11 覆盖。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（58 文件 / 175 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- Provider 三件套：OpenAI / Anthropic / OpenAI-Compatible（Local 预留），registry + `createGateway` 可切换，核心逻辑不感知 Provider。
- 可靠性层：AbortController 超时、HTTP 状态 → 类型化 `LLMError`（retryable 语义正确）、指数退避重试、结构化校验入口。
- 成本/用量：`recordUsage` + `InMemoryUsageStore`，token 计数 + USD 成本（默认 0 只计数）。
- `ModelContext → Provider 请求`（结构化状态注入、Memory 仅 Top-K）。
- **Phase 5 review 项闭环**：`combined-generator.ts` 合并 Scenario + Options → **Turn 从 3 次降为 2 次**，`runNarrativeTurn` 已切换。
- 验收全过：适配器可切换（mock fetch）、重试/超时/计数/成本、错误类型均有测试。

---

## 🟠 待确认 / 应修

**无。**

---

## 🟢 建议（不阻塞，择机处理）

### 1. `normalizeProviderConfig` 强制 `apiKey`
- 位置：`packages/adapters/llm/src/provider-config.ts:24`
- 对无 key 的本地端点（Ollama 等）不便；V1 边界暂不含本地部署，可接受。
- 若本地模型纳入目标，改为按 `kind` 条件校验 apiKey。

### 2. 两个结构化解析器重复
- 位置：`@ag/llm/structured-response.ts`（`validateStructuredResponse`）vs `narrative/structured-parser.ts`（`parseStructuredResponse`）
- 逻辑几乎相同（剥 fence + JSON.parse + Zod）。建议收敛到 `@ag/llm` 单一实现，防两处漂移。

### 3. `responseSchema` 未被 Provider 使用
- `LLMRequest.responseSchema` 当前只在调用方做校验；原生 structured output（如 OpenAI `json_schema`）需在 adapter 接线。功能上已够用。

### 4. `executeWithRetry` 把非 `LLMError` 也当可重试
- 位置：`packages/adapters/llm/src/retry.ts:25`
- 编程错误（TypeError）会被退避重试掩盖并增加延迟；建议对非 `LLMError` 不重试，或仅对已知网络错误重试。

### 5. 尚无 env 配置加载
- API key 目前由调用方传入；Phase 9（真实 LLM 跑 Run）需要 `.env` 加载（`.env` 已在 gitignore）。

---

## 处理建议

- 全部为 🟢 建议，无强制修改；可随 Phase 9（env 加载、真实跑 Run）或 Phase 11（成本分析）自然覆盖。
- 若收敛解析器（#2），改完复跑 `pnpm --filter @ag/llm test && pnpm --filter @ag/narrative test && pnpm build`。

---



## ✅ 修订记录（实现侧，2026-08-16）

1. **apiKey 强制校验**：`normalizeProviderConfig` 现仅对 openai / anthropic 强制 apiKey；`openai-compatible`（Ollama/LocalAI）允许空 key。
2. **结构化解析器收敛**：`@ag/narrative/structured-parser` 改为委托 `@ag/llm.validateStructuredResponse`，单一实现防漂移。
3. **responseSchema 接线**：OpenAIAdapter 在 `LLMRequest.responseSchema` 为对象时输出原生 `response_format: json_schema`（strict）。
4. **重试语义**：`executeWithRetry` 现在只重试 `LLMError`；非 LLMError（编程错误）不重试。
5. **env 配置加载**：新增 `loadProviderConfigFromEnv()`，支持 `LLM_PROVIDER / LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_TIMEOUT_MS / LLM_MAX_RETRIES / LLM_COST_*` 等环境变量。

回归结果：

```text
pnpm --filter @ag/llm test && pnpm --filter @ag/narrative test && pnpm build  ✅
pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm lint ✅
# @ag/llm: 17 tests；@ag/narrative: 14 tests；全仓 60 files / 180 tests passed
```
