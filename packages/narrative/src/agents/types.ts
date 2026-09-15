/**
 * 双 Agent 视角管辖权契约（Master Design §11.11，v1.6 定案）。
 *
 * 生成端按管辖权二分为两个 Agent（门面模式，内部复用既有生成器）：
 * - 玩家 Agent（player）：场景/引子 + 选项——以玩家第一人称「我」描写，
 *   选项行动主语必须为玩家，禁写角色内心（只写可观察表现）。
 * - 角色 Agent（character）：文段拍 + 反应 + 过渡——写角色可观察言行，
 *   旁白以「我」视角叙述，角色内心只允许进入 motive 字段（引擎留存），
 *   禁止描写玩家未做出的新行动。
 *
 * 世界真相由引擎独立计算（GameState/事件/Flow 状态），Agent 只读取
 * 信息合成 prompt（buildSystemRules 注入契约），不互相协商。
 */

/** Agent 角色。 */
export type AgentRole = 'player' | 'character';

/** 视角契约：Agent 管辖权声明，注入 prompt 的 systemRules。 */
export interface ViewContract {
  readonly role: AgentRole;
  /** 管辖权声明（一行，用于日志/文档/测试定位）。 */
  readonly jurisdiction: string;
  /** 注入 prompt 的契约全文（【Agent 管辖权】开头）。 */
  readonly contractText: string;
}

/** 门面层轻量输出审计结果（重校验仍在生成器/Schema 层）。 */
export interface AgentValidation {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/** 叙事 Agent 契约（门面）。 */
export interface NarrativeAgent {
  readonly role: AgentRole;
  readonly viewContract: ViewContract;
  /** 将契约注入基础 systemRules（引擎 ContextBuilder 产出）。 */
  buildSystemRules(baseRules?: string): string;
  /** 输出结构审计。 */
  validateOutput(output: unknown): AgentValidation;
}

/** Agent 门面方法可选参数。 */
export interface AgentCallOptions {
  /**
   * 输出审计发现违规时的回调（结构问题不阻断生成器自身的 fallback 链，
   * 仅作为可观测的管辖权审计信号）。
   */
  onViolation?: (role: AgentRole, violations: readonly string[]) => void;
}

/** 审计输出并在违规时回调。 */
export function auditOutput(
  agent: NarrativeAgent,
  output: unknown,
  onViolation?: (role: AgentRole, violations: readonly string[]) => void,
): AgentValidation {
  const result = agent.validateOutput(output);
  if (!result.ok && onViolation) onViolation(agent.role, result.violations);
  return result;
}
