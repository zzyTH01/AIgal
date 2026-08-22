import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LivePlayReport } from './live-play.js';

/** LivePlayReport → 人工检查用 Markdown（对齐 long-run-artoria.md 的阅读习惯）。 */
export function renderPlaythroughMarkdown(report: LivePlayReport, title: string): string {
  const lines: string[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  lines.push(`# ${title}`, '');
  lines.push(
    `> Provider：${report.providerConfigured ? '真实 LLM（DeepSeek deepseek-chat）' : '内置 DemoProvider'} ｜ ` +
      `轮数：${report.turnsCompleted}/${report.turnsRequested} ｜ 跨天数：${report.daysElapsed}`,
  );
  lines.push(
    `> source 占比：情景 ${pct(report.ratio.scenario)} / 反应 ${pct(report.ratio.reaction)} / 过渡 ${pct(report.ratio.transition)}` +
      `（过渡生成 ${report.transitionsGenerated} 段）`,
  );
  lines.push(
    `> 终局：affection ${report.finalRelationship.affection} ｜ trust ${report.finalRelationship.trust} ｜ stress ${report.finalRelationship.stress} ｜ 活跃记忆 ${report.activeMemoryCount} 条`,
    '',
    '---',
    '',
  );

  for (const turn of report.turns) {
    lines.push(`## 第 ${turn.index} 轮（Day ${turn.day} · ${turn.time} · ${turn.locationId}）`, '');

    if (turn.transition) {
      lines.push(
        `### 过渡文段（${turn.transition.source}；${turn.transition.timeChange.previous} → ${turn.transition.timeChange.current}）`,
        '',
      );
      lines.push(`> ${turn.transition.narration}`, '');
      for (const dialogue of turn.transition.dialogues) {
        lines.push(`> **${dialogue.speaker || '？'}**：${dialogue.text}`, '');
      }
      if (turn.transition.referencedMemoryContents.length > 0) {
        lines.push(
          `*引用记忆：${turn.transition.referencedMemoryContents.map((content) => `「${content}」`).join('、')}*`,
          '',
        );
      }
    }

    lines.push(`### 情景（${turn.scenario.source}）`, '', turn.scenario.text, '');

    lines.push('### 选项', '');
    for (const option of turn.options) {
      lines.push(
        `${option.label}. ${option.text} [${option.actions.join('/')}${option.intent.length ? ` · ${option.intent.join('/')}` : ''} · risk ${option.risk}]`,
      );
    }
    lines.push('');

    if (turn.choice) {
      lines.push('### 选择', '', `${turn.choice.label}. ${turn.choice.text}`, '');
    }

    if (turn.reaction) {
      lines.push(`### 反应（${turn.reaction.source}）`, '', turn.reaction.text, '');
    }

    if (
      turn.relationshipImpact.length > 0 ||
      turn.psychologyImpact.length > 0 ||
      turn.newMemories.length > 0
    ) {
      lines.push('### 影响', '');
      for (const change of turn.relationshipImpact) {
        lines.push(
          `- 关系 ${change.metric}：${change.before} → ${change.after}（${change.delta >= 0 ? '+' : ''}${change.delta}）`,
        );
      }
      for (const change of turn.psychologyImpact) {
        lines.push(
          `- 二次结算 ${change.name}.${change.metric}：${change.before} → ${change.after}（${change.delta >= 0 ? '+' : ''}${change.delta}）`,
        );
      }
      for (const memory of turn.newMemories) {
        lines.push(`- 新记忆：「${memory.content}」（重要度 ${memory.importance}）`);
      }
      lines.push('');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

export function writePlaythroughMarkdown(
  report: LivePlayReport,
  title: string,
  filePath: string,
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, renderPlaythroughMarkdown(report, title), 'utf8');
}
