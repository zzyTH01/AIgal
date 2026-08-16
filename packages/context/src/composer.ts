import type { ModelContext } from '@ag/schemas';

export interface PromptComposition {
  prompt: string;
}

/** PromptComposer：ModelContext → LLM Prompt 文本。 */
export function composePrompt(context: ModelContext): string {
  const memories = context.retrievedMemories.map(
    (memory, index) => `[记忆 ${index + 1}] ${memory.content}（重要度 ${memory.importance}）`,
  );
  const events = context.recentEvents.map((event) => `[事件] ${event.title}：${event.description}`);
  const internal = Object.entries(context.internalState)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('；');

  return [
    `[System]\n${context.systemRules}`,
    `[Current State]\n${context.currentState.run.day} ${context.currentState.run.time} ${context.currentState.world.currentLocationId}`,
    ...(events.length > 0 ? [`[Recent Events]\n${events.join('\n')}`] : []),
    ...(memories.length > 0 ? [`[Retrieved Memories]\n${memories.join('\n')}`] : []),
    `[Internal State]\n${internal}`,
    `[Task]\n${context.generationTask.task}（输出 ${context.generationTask.outputSchema}）`,
  ].join('\n\n');
}

export const promptComposer = Object.freeze({ compose: composePrompt });
