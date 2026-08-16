import type { ModelContext } from '@ag/schemas';
import type { STPromptSections } from './types.js';

/** ModelContext → SillyTavern Prompt。 */
export function modelContextToStPrompt(context: ModelContext): string {
  const sections: STPromptSections = {
    systemRules: context.systemRules,
    currentState: [
      `Day ${context.day} ${context.time}`,
      `地点：${context.currentState.world.currentLocationId}`,
      ...Object.values(context.currentState.relationships).map(
        (relationship) =>
          `${relationship.sourceId}→${relationship.targetId}(${relationship.type}) affection=${relationship.affection} trust=${relationship.trust}`,
      ),
    ].join('\n'),
    recentEvents: context.recentEvents
      .map((event) => `${event.title}：${event.description}`)
      .join('\n'),
    memories: context.retrievedMemories
      .map((memory) => `[${memory.id}] ${memory.content}（strength=${memory.strength}）`)
      .join('\n'),
    internalState: Object.entries(context.internalState)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n'),
    task: `${context.generationTask.task}（输出 ${context.generationTask.outputSchema}）`,
  };

  return [
    `[System]\n${sections.systemRules}`,
    `[Current State]\n${sections.currentState}`,
    `[Recent Events]\n${sections.recentEvents || '（无）'}`,
    `[Retrieved Memories]\n${sections.memories || '（无）'}`,
    `[Internal State]\n${sections.internalState || '（无）'}`,
    `[Task]\n${sections.task}`,
  ].join('\n\n');
}

/** ST Prompt → 分节数据。 */
export function parseStPrompt(prompt: string): STPromptSections {
  return {
    systemRules: readSection(prompt, 'System'),
    currentState: readSection(prompt, 'Current State'),
    recentEvents: readSection(prompt, 'Recent Events'),
    memories: readSection(prompt, 'Retrieved Memories'),
    internalState: readSection(prompt, 'Internal State'),
    task: readSection(prompt, 'Task'),
  };
}

/** 用解析出的 ST Prompt 分节回填 ModelContext（仅可逆字段）。 */
export function applyStPromptSections(
  context: ModelContext,
  sections: STPromptSections,
): ModelContext {
  return {
    ...context,
    systemRules: sections.systemRules || context.systemRules,
    generationTask: {
      task: sections.task || context.generationTask.task,
      outputSchema: context.generationTask.outputSchema,
    },
    internalState: { ...context.internalState, stPrompt: sections.internalState },
  };
}

function readSection(prompt: string, name: string): string {
  const match = prompt.match(new RegExp(`\\[${name}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[|$)`));
  return match?.[1]?.trim() ?? '';
}
