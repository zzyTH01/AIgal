import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LivePlayReport } from './live-play.js';

/** LivePlayReport → 人工检查用 Markdown（拍驱动：文段序列 + 选择点 + 影响）。 */
export function renderPlaythroughMarkdown(report: LivePlayReport, title: string): string {
  const lines: string[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  lines.push(`# ${title}`, '');
  lines.push(
    `> Provider：${report.providerConfigured ? '真实 LLM（DeepSeek deepseek-chat）' : '内置 DemoProvider'} ｜ ` +
      `轮数：${report.turnsCompleted}/${report.turnsRequested} ｜ 跨天数：${report.daysElapsed}`,
  );
  lines.push(
    `> source 占比：文段拍 ${pct(report.ratio.narrativeBeatLlm)} / 选择拍 ${pct(
      report.ratio.choiceBeatLlm,
    )} / 反应 ${pct(report.ratio.reaction)}`,
  );
  lines.push(
    `> 拍统计：文段拍 ${report.totalNarrativeBeats} 个 / 选择点 ${report.totalChoicePoints} 个`,
  );
  lines.push(
    `> 终局：affection ${report.finalRelationship.affection} ｜ trust ${report.finalRelationship.trust} ｜ stress ${report.finalRelationship.stress} ｜ 活跃记忆 ${report.activeMemoryCount} 条`,
    '',
    '---',
    '',
  );

  for (const turn of report.turns) {
    lines.push(
      `## 第 ${turn.index} 轮（Day ${turn.day} · ${turn.time} · ${turn.locationId} · 事件重要性 ${turn.eventImportance}）`,
      '',
    );

    for (const beat of turn.beats) {
      if (beat.kind === 'narrative') {
        lines.push(
          `### 文段拍（${beat.source}${beat.branchPotential ? ` · 分支价值 ${beat.branchPotential}` : ''}）`,
          '',
        );
        if (beat.narration) lines.push(`> ${beat.narration}`, '');
        for (const dialogue of beat.dialogues ?? []) {
          lines.push(`> **${dialogue.speaker || '？'}**：${dialogue.text}`, '');
        }
      } else {
        lines.push(`### 选择点（${beat.source}）`, '');
        if (beat.intro) lines.push(`*${beat.intro}*`, '');
      }
    }

    lines.push('### 选项', '');
    for (const option of turn.options) {
      lines.push(
        `${option.label}. ${option.text} [${option.actions.join('/')}${
          option.intent.length ? ` · ${option.intent.join('/')}` : ''
        } · risk ${option.risk}]`,
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
          `- 关系 ${change.metric}：${change.before} → ${change.after}（${
            change.delta >= 0 ? '+' : ''
          }${change.delta}）`,
        );
      }
      for (const change of turn.psychologyImpact) {
        lines.push(
          `- 二次结算 ${change.name}.${change.metric}：${change.before} → ${change.after}（${
            change.delta >= 0 ? '+' : ''
          }${change.delta}）`,
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
