# JSON Schema 目录（数据契约单一事实来源）

本目录是 `@ag/schemas` 的 JSON Schema 输出目录，将在 **Phase 1（数据契约冻结）** 中写入：

- `game-state.schema.json`
- `character.schema.json`
- `relationship.schema.json`
- `option.schema.json`
- `event.schema.json`
- `state-delta.schema.json`
- `turn-result.schema.json`
- `context.schema.json`
- `memory.schema.json`
- `save.schema.json`
- `project.schema.json`

当前为 Phase 0.5 占位目录。正式 Schema 必须与 `src/` 中的 TypeScript 类型、Zod 运行时校验保持同源（Master Design §4.12）。

> 生成文件，勿手改：本目录 JSON 由 `pnpm --filter @ag/schemas build` 执行 `scripts/generate-json-schema.mjs` 从 `src/*.ts` 的 Zod Schema 同源生成；如需改契约请改 `src/*.ts`。
