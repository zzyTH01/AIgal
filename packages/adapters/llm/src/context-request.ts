import type { ModelContext } from '@ag/schemas';
import type { LLMRequest } from './llm-port.js';

export interface ModelContextRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  taskDescription?: string;
}

/**
 * ModelContext → Provider 请求转换。
 * 结构化状态直接注入 prompt；Memory 只注入 Context 中已检索的 Top-K。
 */
export function modelContextToRequest(
  context: ModelContext,
  options: ModelContextRequestOptions = {},
): LLMRequest {
  const eventLines = [
    ...(context.currentEvent
      ? [`当前事件：${context.currentEvent.title} / ${context.currentEvent.description}`]
      : []),
    ...context.recentEvents.map((event) => `近期事件：${event.title} / ${event.description}`),
  ];
  const memoryLines = context.retrievedMemories.map(
    (memory, index) => `[记忆${index + 1}] ${memory.content}`,
  );
  const state = context.currentState;
  const stateLines = [
    `Day ${state.run.day} ${state.run.time}，地点 ${state.world.currentLocationId}。`,
    ...Object.values(state.relationships).map(
      (relationship) =>
        `关系 ${relationship.sourceId}→${relationship.targetId}：affection ${relationship.affection} / trust ${relationship.trust}`,
    ),
  ];

  return {
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    messages: [
      { role: 'system', content: context.systemRules },
      {
        role: 'user',
        content: [
          `任务：${options.taskDescription ?? context.generationTask.task}`,
          ...stateLines,
          ...eventLines,
          ...memoryLines,
        ].join('\n'),
      },
    ],
    responseSchema: context.generationTask.outputSchema,
  };
}
