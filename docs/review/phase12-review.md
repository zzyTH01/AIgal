# Phase 12 Presentation Layer —— 审查反馈（Review Feedback）

> 审查人：审查侧（独立于实现）｜ 审查对象：`b3cdd8d`（Phase 12 Presentation Layer，路线图最后阶段）
> 结论：**无阻断项、无应修项，Phase 12 通过。** 表现层不改变 Core 逻辑的验收达成。
> 以下建议均为可选项，随资源接入/后续排期覆盖。

---

## ✅ 已验证通过（基线确认）

- `pnpm build` / `pnpm test`（76 文件 / 210 用例）/ `pnpm typecheck` / `pnpm lint` 全绿。
- **表现层纯净**：全部表现组件（CharacterPortrait / Background / CgGallery / AudioPanel / Typewriter）**不引用 `@ag/core` / `@ag/runtime`**，纯展示、只读传入的 state props，不突变任何核心状态——精确落地"表现层不应该改变 Core 游戏逻辑"（§102）。
- App 集成：背景（地点名）、立绘（角色名 + 当前情绪）、打字机（反应文本）、CG 画廊（`meta.endingsDiscovered`）、TTS 占位——表现层从现有 GameState 派生，无新状态写入。
- 测试覆盖：表现组件渲染 + Typewriter fake timers 打字时序。
- **Core 回归全绿**：210 用例含全部 Core/World/Memory/Context/Narrative 测试，证明 Core 逻辑未被表现层改动。

---

## 🟠 待确认 / 应修

**无。**

---

## 🟢 建议（不阻塞，择机处理）

### 1. 立绘/背景为 CSS 占位（渐变块 + 名字）
- 真实立绘/背景图应来自 `GameProject.assets`（schema 已有 `assets` 字段）；当前纯 CSS 占位，符合"V1 暂不作核心"边界。

### 2. TTS / BGM / SE 为 disabled 占位按钮
- 符合 V1"全语音暂不作为核心"；后续接入时在 `AudioPanel` 接线真实音频源。

### 3. `CharacterPortrait` 已带情绪（`emotion.primary`）
- 为未来"情绪换立绘"预留了挂点；真实情绪→立绘映射可随资源接入。

---

## 处理建议

- 全部为 🟢 建议，无强制修改；随资源接入/后续排期自然覆盖。
- 本阶段即路线图 **Phase 0.5–12 全部完成**；建议在 DEVELOPMENT_PLAN 标注项目里程碑达成，并复核 CLAUDE.md 进度。

---

## ✅ 修订记录（实现侧）

_（由实现 agent 在此记录处理结果与回归）_
