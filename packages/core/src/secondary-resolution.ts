import {
  finalStateDeltaSchema,
  type FinalStateDelta,
  type GameState,
  type NPCReactionStructured,
  type Option,
} from '@ag/schemas';
import { clamp } from './game-state.js';

const POSITIVE_EMOTIONS = ['relief', 'joy', 'happy', 'affection', 'grateful', 'calm', 'pleased'];
const NEGATIVE_EMOTIONS = ['anger', 'sadness', 'fear', 'disgust', 'annoyed', 'hurt'];
const CLOSENESS_INTENTS = ['seek_closeness', 'care', 'affection', 'romance', 'gratitude'];

export interface SecondaryResolutionOptions {
  targetCharacterId?: string;
}

/**
 * Stage 11 Secondary State Resolution：
 * 将 NPC Reaction 的结构化 emotion/intent 映射为角色心理/情绪的二次 delta。
 */
export function resolveSecondaryDelta(
  state: GameState,
  option: Option,
  reaction: NPCReactionStructured,
  options: SecondaryResolutionOptions = {},
): FinalStateDelta {
  const relationship = Object.values(state.relationships)[0];
  const targetCharacterId =
    options.targetCharacterId ??
    (relationship?.sourceId === 'player' ? relationship.targetId : relationship?.sourceId) ??
    Object.keys(state.characters)[0];
  if (!targetCharacterId) return finalStateDeltaSchema.parse({ phase: 'final' });

  const character = state.characters[targetCharacterId];
  if (!character) return finalStateDeltaSchema.parse({ phase: 'final' });

  const intensity = reaction.emotion?.intensity ?? 0;
  const scale = intensity / 10;
  const positive = reaction.emotion
    ? POSITIVE_EMOTIONS.includes(reaction.emotion.type.toLowerCase())
    : false;
  const negative = reaction.emotion
    ? NEGATIVE_EMOTIONS.includes(reaction.emotion.type.toLowerCase())
    : false;

  const emotionEnergyDelta = Math.round((positive ? 1 : negative ? -1 : 0) * scale);
  const valenceDelta = Math.round((positive ? 1 : negative ? -1 : 0) * scale * 2);
  const stressDelta = Math.round((positive ? -1 : negative ? 1 : 0) * scale);
  const lonelinessDelta =
    reaction.intent && CLOSENESS_INTENTS.includes(reaction.intent.type)
      ? -Math.round(reaction.intent.intensity / 10)
      : 0;
  const securityDelta =
    reaction.intent && CLOSENESS_INTENTS.includes(reaction.intent.type)
      ? Math.round(reaction.intent.intensity / 20)
      : positive
        ? Math.round(scale / 2)
        : 0;

  const psychology: Record<string, { before: number; after: number; delta: number }> = {};
  const emotion: Record<string, { before: number; after: number; delta: number }> = {};

  addChange(psychology, 'stress', character.psychology.stress, stressDelta);
  addChange(psychology, 'loneliness', character.psychology.loneliness, lonelinessDelta);
  addChange(psychology, 'security', character.psychology.security, securityDelta);
  addChange(emotion, 'intensity', character.emotion.intensity, Math.round(scale));
  addChange(emotion, 'energy', character.emotion.energy, emotionEnergyDelta);
  addChange(emotion, 'valence', character.emotion.valence, valenceDelta, -100, 100);

  const hasChanges = Object.keys(psychology).length > 0 || Object.keys(emotion).length > 0;
  return finalStateDeltaSchema.parse({
    phase: 'final',
    characters: hasChanges ? { [targetCharacterId]: { psychology, emotion } } : undefined,
    meta: undefined,
  });
}

function addChange(
  target: Record<string, { before: number; after: number; delta: number }>,
  metric: string,
  before: number,
  delta: number,
  min = 0,
  max = 100,
): void {
  if (delta === 0) return;
  const after = clamp(before + delta, min, max);
  target[metric] = { before, after, delta: after - before };
}
