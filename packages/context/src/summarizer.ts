import type { GameState } from '@ag/schemas';

/** StateSummarizer：把 GameState 压缩成结构化文本，供 Context/Prompt 使用。 */
export function summarizeGameState(state: GameState): string {
  const characterLines = Object.values(state.characters).map((character) => {
    const emotion = character.emotion;
    const psychology = character.psychology;
    return (
      `${character.identity.name}(${character.identity.role})：` +
      `情绪 ${emotion.primary}/${emotion.intensity}，valence ${emotion.valence}；` +
      `压力 ${psychology.stress}，孤独 ${psychology.loneliness}，依赖 ${psychology.dependence}`
    );
  });

  const relationshipLines = Object.values(state.relationships).map((relationship) => {
    return (
      `${relationship.sourceId}→${relationship.targetId}(${relationship.type})：` +
      `affection ${relationship.affection}，trust ${relationship.trust}，intimacy ${relationship.intimacy}`
    );
  });

  return [
    `Run ${state.run.runId} Day ${state.run.day} ${state.run.time}，地点 ${state.world.currentLocationId}。`,
    `天气 ${state.world.weather.type}，weekday ${state.world.weekday}。`,
    ...characterLines,
    ...relationshipLines,
    `Daily Progress ${state.run.dailyProgress}/${state.run.dailyProgressLimit}。`,
  ].join('\n');
}

export const stateSummarizer = Object.freeze({ summarize: summarizeGameState });
