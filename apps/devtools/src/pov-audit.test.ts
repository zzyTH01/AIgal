import { describe, expect, it } from 'vitest';
import {
  auditPov,
  classifyOptionSubject,
  findInnerLeaks,
  hasFirstPersonOpening,
} from './pov-audit.js';

describe('POV 审计（#16 四项指标的自动化代理）', () => {
  it('识别旁白内心泄露（#16 的典型例句，含跨逗号写法）', () => {
    expect(findInnerLeaks('她深吸一口气，试图将残梦压回记忆深处')).toContain('她深吸一口气，试图');
    expect(findInnerLeaks('她想起昨天在图书馆的谈话')).toContain('她想起');
    // 可观察言行不算泄露
    expect(findInnerLeaks('她低下头，声音很轻')).toEqual([]);
    // 不跨句末标点拼接相邻两句
    expect(findInnerLeaks('她转身离开。我明白了一些事。')).toEqual([]);
  });

  it('判定「我」视角开场，可跳过引号装饰', () => {
    expect(hasFirstPersonOpening('我看着窗外的雨。')).toBe(true);
    expect(hasFirstPersonOpening('「我」抬头看向她。')).toBe(true);
    expect(hasFirstPersonOpening('教室的灯光暗了下来。')).toBe(false);
  });

  it('判定选项主语：玩家 / 祈使惯例 / NPC 越权', () => {
    expect(classifyOptionSubject('我轻轻问她还记得那天吗', '明日香')).toBe('player');
    expect(classifyOptionSubject('把花瓣夹进笔记本里', '明日香')).toBe('bare');
    expect(classifyOptionSubject('明日香冲去真嗣的住处把他拽出来', '明日香')).toBe('npc');
    expect(classifyOptionSubject('她转身走向窗边', '明日香')).toBe('npc');
  });

  it('汇总报告：干净样本四项指标全过', () => {
    const report = auditPov({
      narrations: ['我推开教室的门，她正坐在窗边。', '我把书包放下，雨声还在窗外响着。'],
      options: ['我坐到她旁边', '把伞递过去', '轻声问她要不要一起回去'],
      npcName: '明日香',
      beatsWithMotive: 2,
      narrativeBeatCount: 2,
    });

    expect(report.firstPersonOpeningRatio).toBe(1);
    expect(report.innerLeakCount).toBe(0);
    expect(report.playerSubjectRatio).toBe(1);
    expect(report.npcSubjectOptions).toEqual([]);
    expect(report.motiveCoverage).toBe(1);
  });

  it('汇总报告：违约样本（#16 回归）被捕获', () => {
    const report = auditPov({
      narrations: ['她深吸一口气，试图将残梦压回记忆深处。'],
      options: ['明日香冲去真嗣的住处', '她转身走向窗边'],
      npcName: '明日香',
      beatsWithMotive: 0,
      narrativeBeatCount: 1,
    });

    expect(report.firstPersonOpeningRatio).toBe(0);
    expect(report.innerLeakCount).toBe(1);
    expect(report.npcSubjectOptions).toHaveLength(2);
    expect(report.playerSubjectRatio).toBe(0);
    expect(report.motiveCoverage).toBe(0);
  });
});
