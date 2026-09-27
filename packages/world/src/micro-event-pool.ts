import {
  eventDefinitionSchema,
  type EventDefinition,
  type EventInstance,
  type GameState,
} from '@ag/schemas';
import type { RNG } from '@ag/core';

/**
 * P3 S2：Micro 事件池（EVENT_LIFE_PLAN §5.2.1）。
 *
 * 三层事件中的 Micro 层——偶遇 / 一句话 / 短暂互动 / 环境变化 / 角色独处。
 * 模板程序化渲染（无 LLM 调用），低权重高频，用于填充大事件之间的"生活感"。
 * 旁白遵循 v1.6 视角契约：玩家第一人称「我」，角色只写可观察言行。
 */

export type MicroEventCategory =
  'encounter' | 'one_liner' | 'brief_interaction' | 'environment' | 'solo';

export interface MicroTemplateContext {
  day: number;
  time: string;
  locationId: string;
  characterId: string;
  characterName: string;
}

export interface MicroEventTemplate {
  templateId: string;
  category: MicroEventCategory;
  /** 可选门槛（如时段）；未提供则恒可用。 */
  matches?: (context: MicroTemplateContext) => boolean;
  render: (context: MicroTemplateContext) => {
    title: string;
    description: string;
    /** 玩家视角旁白（可含多句，runtime 按。切分为 1–N 个文段拍）。 */
    narration: string;
    /** 角色视角轻量记忆内容（S5 记忆候选）。 */
    memoryContent: string;
  };
}

export interface MicroEventSelection {
  templateId: string;
  category: MicroEventCategory;
  definition: EventDefinition;
  instance: EventInstance;
  narration: string;
  memoryContent: string;
}

export interface MicroEventSelectionInput {
  state: GameState;
  rng: RNG;
  characterId: string;
  characterName: string;
  /**
   * 概率门：rng.next() >= probability 时不产出（S3 调度用）。
   * Micro 不抢占意图/自主发起事件——调用方保证只在无 proactive 事件时调用。
   */
  probability?: number;
  /** 近期已用模板（运行时滚动维护，防连续重复）。 */
  excludeTemplateIds?: readonly string[];
}

function greetingByTime(time: string): string {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  if (Number.isNaN(hour)) return '辛苦了。';
  if (hour < 12) return '早上好。';
  if (hour < 15) return '辛苦了。';
  return '放学小心。';
}

/** 内置模板：五类各 1–2 个，全部程序化渲染。 */
export const BUILTIN_MICRO_TEMPLATES: readonly MicroEventTemplate[] = [
  {
    templateId: 'encounter_nod',
    category: 'encounter',
    render: (c) => ({
      title: '走廊擦肩',
      description: `${c.characterName}与玩家在走廊迎面遇上，点头致意后各自走开。`,
      narration: `走廊拐角，我与${c.characterName}迎面遇上。她朝我微微颔首，脚步没有停下，发梢掠过一缕晨光。`,
      memoryContent: '上下学路上与玩家迎面相遇，彼此点头致意，没有停下交谈。',
    }),
  },
  {
    templateId: 'encounter_gaze',
    category: 'encounter',
    render: (c) => ({
      title: '书架另一侧',
      description: `图书馆里与${c.characterName}对视一眼，又各自低头。`,
      narration: `我在书架的另一侧认出了${c.characterName}的侧影。我们对视了一眼，又各自低头，谁都没有先开口。`,
      memoryContent: '在图书馆与玩家对视了一眼，谁都没有先开口，但记住了那一眼。',
    }),
  },
  {
    templateId: 'oneliner_greeting',
    category: 'one_liner',
    render: (c) => {
      const line = greetingByTime(c.time);
      return {
        title: '擦肩的一句话',
        description: `${c.characterName}与玩家擦肩时轻声打招呼。`,
        narration: `${c.characterName}与我擦肩而过时轻声说：「……${line}」声音不大，却足够让只有两个人的走廊显得不那么空。`,
        memoryContent: '在走廊与玩家擦肩时主动打了一句招呼。',
      };
    },
  },
  {
    templateId: 'brief_return_item',
    category: 'brief_interaction',
    render: (c) => ({
      title: '掉落的笔记本',
      description: `${c.characterName}的笔记本滑落，玩家拾起递还。`,
      narration: `一本笔记本从${c.characterName}的臂弯里滑落。我先一步弯腰拾起递还，她接过时道了声谢，指尖在封面上停了半秒。`,
      memoryContent: '掉了笔记本，被玩家捡起递还，道了谢。',
    }),
  },
  {
    templateId: 'environment_petal',
    category: 'environment',
    render: (c) => ({
      title: '落在桌角的花瓣',
      description: `樱花被风卷进走廊，落在${c.characterName}桌角。`,
      narration: `风把窗外的樱花卷进来几片，落在${c.characterName}的桌角。她盯着看了很久，没有拂去，最后轻轻把花瓣拢进掌心。`,
      memoryContent: '樱花瓣落在桌角，我把它拢进了掌心，没有让玩家看见表情。',
    }),
  },
  {
    templateId: 'environment_light',
    category: 'environment',
    matches: (c) => {
      const hour = Number.parseInt(c.time.slice(0, 2), 10);
      return !Number.isNaN(hour) && hour >= 14;
    },
    render: (c) => ({
      title: '西斜的光',
      description: `午后西斜的阳光移过${c.characterName}的桌面。`,
      narration: `西斜的阳光从窗棂间移过来，慢慢爬上${c.characterName}的桌面。她把课本往阴影里挪了挪，像是不愿承认自己在躲那点暖意。`,
      memoryContent: '午后的光爬上桌面，我把课本挪进阴影里，被玩家看在眼里。',
    }),
  },
  {
    templateId: 'solo_reading',
    category: 'solo',
    render: (c) => ({
      title: '窗边读书',
      description: `${c.characterName}独自靠在窗边看书。`,
      narration: `隔着半个教室，我看见${c.characterName}独自靠在窗边看书。翻页的声音比挂钟的秒针还轻，阳光把她的侧脸描了一层金边。`,
      memoryContent: '独自在窗边看书，感觉到玩家的视线，但没有抬头。',
    }),
  },
  {
    templateId: 'solo_after_school',
    category: 'solo',
    render: (c) => ({
      title: '放学后的教室',
      description: `放学后${c.characterName}独自留在教室。`,
      narration: `放学后的教室只剩${c.characterName}一个人。她望着窗外的操场，手指在窗框上轻轻敲着什么节拍，没有察觉门口的我。`,
      memoryContent: '放学后独自留在教室望向窗外，享受独处的安静，没发现玩家在门口。',
    }),
  },
];

export class MicroEventPool {
  private readonly templates = new Map<string, MicroEventTemplate>();

  constructor(templates: readonly MicroEventTemplate[] = BUILTIN_MICRO_TEMPLATES) {
    for (const template of templates) {
      this.templates.set(template.templateId, template);
    }
  }

  list(): MicroEventTemplate[] {
    return [...this.templates.values()];
  }

  /** 概率门 + 排除近期模板 + 随机选取，产出合法的 micro EventDefinition/Instance。 */
  trySelect(input: MicroEventSelectionInput): MicroEventSelection | undefined {
    const { state, rng, characterId, characterName } = input;
    const probability = input.probability ?? 0.35;
    if (rng.next() >= probability) return undefined;

    const context: MicroTemplateContext = {
      day: state.run.day,
      time: state.run.time,
      locationId: state.world.currentLocationId,
      characterId,
      characterName,
    };
    const excluded = new Set(input.excludeTemplateIds ?? []);
    const eligible = this.list().filter(
      (template) => !excluded.has(template.templateId) && (template.matches?.(context) ?? true),
    );
    if (eligible.length === 0) return undefined;

    const template = eligible[Math.floor(rng.next() * eligible.length) % eligible.length]!;
    const rendered = template.render(context);
    const eventId = `event_micro_${template.templateId}`;
    const definition = eventDefinitionSchema.parse({
      eventId,
      type: 'daily',
      rarity: 'common',
      title: rendered.title,
      description: rendered.description,
      baseWeight: 1,
      conditions: {},
      cooldown: { days: 0, turns: 0 },
      allowedLocationIds: undefined,
      tags: ['micro', template.category],
      importance: 'micro',
    });
    const nonce = Math.floor(rng.next() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    const instance: EventInstance = {
      instanceId: `${eventId}/run_${state.run.runId}/day_${state.run.day}/turn_${state.run.turn}_${nonce}`,
      eventId,
      runId: state.run.runId,
      day: state.run.day,
      turn: state.run.turn,
      locationId: state.world.currentLocationId,
      title: rendered.title,
      description: rendered.description,
      status: 'active',
      createdAt: { day: state.run.day, time: state.run.time },
      origin: 'pool',
    };
    return {
      templateId: template.templateId,
      category: template.category,
      definition,
      instance,
      narration: rendered.narration,
      memoryContent: rendered.memoryContent,
    };
  }
}
