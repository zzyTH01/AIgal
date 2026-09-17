/**
 * POV 审计（Master Design §11.11 叙事视角管辖权 / known-issues #16）。
 *
 * #16 的复验结论此前依赖人工分析对局 Markdown（「她想起/她心想/她感到/她试图/她暗自」命中数、
 * 拍以「我」开场比例等四项指标），CLI 不可复现——视角契约一旦回归只能靠人眼发现。
 * 本模块把这四项指标做成纯函数，由 `live-verify` / `live-play` 收集文本后调用，
 * 使 #16 类回归重新变得可被 CLI 捕获。
 *
 * 注意：本审计是**启发式信号**而非硬门禁——它基于代词/动词表与开头窗口做判定。已知局限：
 * - **漏报**：改写措辞绕过词表（如「她心里翻涌着说不清的东西」）不会被捕获。
 * - **误报**：代词与动词跨小句时，动作主体可能不是角色。典型如「我看着她，明白了一些事」，
 *   会被记为「她，明白」。因此报告中保留命中片段供人工复核，**违约只报告不阻断**。
 * - **只审计旁白**：对话行中角色说「我知道」是合法台词，不在此审计范围（旁白才受视角契约约束）。
 */

/** 角色内心活动动词表：与 #16 复验时人工统计的口径一致，并补充常见近义写法。 */
const INNER_ACTIVITY_VERBS = [
  '想起',
  '想道',
  '心想',
  '暗想',
  '心念',
  '感到',
  '觉得',
  '试图',
  '暗自',
  '意识到',
  '明白',
  '知道',
  '察觉',
  '琢磨',
  '盘算',
  '回味',
  '懊恼',
  '庆幸',
  '决定',
].join('|');

/**
 * 内心泄露：第三人称代词 + 心理动词（旁白只允许写可观察言行，内心须进 motive 字段）。
 * 允许代词与动词之间夹少量修饰词或跨一个逗号（「她深吸一口气，试图…」是真泄露），
 * 但不跨句末标点——避免把相邻两句拼成一次命中。
 */
const INNER_LEAK_PATTERN = new RegExp(`[她他它][^。！？\\n]{0,8}?(?:${INNER_ACTIVITY_VERBS})`, 'g');

/** 开头窗口：判定「以「我」视角开场」时只看开头这么多字符（对齐 #16 人工口径）。 */
const OPENING_WINDOW = 24;

/** 选项主语判定窗口。 */
const OPTION_HEAD_WINDOW = 12;

export interface PovAuditInput {
  /** 旁白样本（文段拍 narration / 选择拍 intro / 反应 narrative），逐条审计内心泄露与开场人称。 */
  narrations: readonly string[];
  /** 选项文案（option.presentation.text）。 */
  options: readonly string[];
  /** 当前 NPC 名，用于识别「选项以角色为主语」的越权。 */
  npcName?: string;
  /** 带 motive 字段的文段拍数（内心只允许出现在这里）。 */
  beatsWithMotive?: number;
  /** 文段拍总数（motive 覆盖率的基数）。 */
  narrativeBeatCount?: number;
}

export interface PovAuditReport {
  narrationSamples: number;
  /** 开头窗口内出现「我」的旁白数（第一人称视角开场的代理指标）。 */
  firstPersonOpening: number;
  firstPersonOpeningRatio: number;
  /** 内心泄露命中数：旁白里出现「她想起」这类不可观察的内心描写。 */
  innerLeakCount: number;
  /** 命中的旁白片段（截断，供人工复核误报）。 */
  innerLeaks: string[];
  /** motive 覆盖率：角色内心应主要落在 motive 字段。 */
  motiveCoverage: number;
  optionSamples: number;
  /** 主语明确为玩家的选项数（「我……」开头）。 */
  firstPersonOptions: number;
  /** 无显式主语、按 galgame 祈使惯例视为玩家主语的选项数（「轻轻握住她的手」）。 */
  bareOptions: number;
  /** 越权选项：以 NPC 名或第三人称代词作主语的选项文案。 */
  npcSubjectOptions: string[];
  /** 玩家主语占比 = （显式「我」+ 祈使惯例）/ 选项总数。 */
  playerSubjectRatio: number;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 去掉开头的空白、引号与括号装饰，露出真正的首字。 */
function stripLeadingDecorations(text: string): string {
  return text.trim().replace(/^[「『“"'（(【[]+/, '');
}

/** 旁白是否以「我」的视角开场（开头窗口内出现「我」）。 */
export function hasFirstPersonOpening(text: string): boolean {
  return stripLeadingDecorations(text).slice(0, OPENING_WINDOW).includes('我');
}

/** 找出旁白中的内心泄露片段。 */
export function findInnerLeaks(text: string): string[] {
  const matches = text.match(INNER_LEAK_PATTERN);
  return matches ?? [];
}

type OptionSubject = 'player' | 'npc' | 'bare';

/** 判定单个选项的叙述主语。 */
export function classifyOptionSubject(text: string, npcName?: string): OptionSubject {
  const head = stripLeadingDecorations(text);
  if (npcName && head.startsWith(npcName)) return 'npc';
  if (/^[她他]/.test(head)) return 'npc';
  if (/^我/.test(head.slice(0, OPTION_HEAD_WINDOW))) return 'player';
  return 'bare';
}

/** 汇总 POV 审计报告。 */
export function auditPov(input: PovAuditInput): PovAuditReport {
  const narrations = input.narrations;
  const firstPersonOpening = narrations.filter(hasFirstPersonOpening).length;
  const innerLeaks = narrations.flatMap(findInnerLeaks);

  const options = input.options;
  let firstPersonOptions = 0;
  let bareOptions = 0;
  const npcSubjectOptions: string[] = [];
  for (const option of options) {
    const subject = classifyOptionSubject(option, input.npcName);
    if (subject === 'npc') npcSubjectOptions.push(option);
    else if (subject === 'player') firstPersonOptions += 1;
    else bareOptions += 1;
  }

  const narrativeBeatCount = input.narrativeBeatCount ?? 0;
  const beatsWithMotive = input.beatsWithMotive ?? 0;

  return {
    narrationSamples: narrations.length,
    firstPersonOpening,
    firstPersonOpeningRatio:
      narrations.length > 0 ? round(firstPersonOpening / narrations.length) : 0,
    innerLeakCount: innerLeaks.length,
    innerLeaks: innerLeaks.slice(0, 10),
    motiveCoverage: narrativeBeatCount > 0 ? round(beatsWithMotive / narrativeBeatCount) : 0,
    optionSamples: options.length,
    firstPersonOptions,
    bareOptions,
    npcSubjectOptions: npcSubjectOptions.slice(0, 10),
    playerSubjectRatio:
      options.length > 0 ? round((firstPersonOptions + bareOptions) / options.length) : 0,
  };
}
