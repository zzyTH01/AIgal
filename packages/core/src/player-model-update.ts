import type { GameState, NPCReactionStructured, Option } from '@ag/schemas';
import { clamp, cloneGameState } from './game-state.js';

/**
 * Stage 13 Player Model Update：
 * 角色根据玩家行为与自身人格，更新对玩家的主观认知。
 */
export function updatePlayerModelFromTurn(
  state: GameState,
  option: Option,
  reaction: NPCReactionStructured,
): GameState {
  const next = cloneGameState(state);
  const model = next.playerModel;
  const relationship = Object.values(next.relationships)[0];
  const targetCharacterId =
    relationship?.sourceId === 'player' ? relationship.targetId : relationship?.sourceId;
  const character = targetCharacterId ? next.characters[targetCharacterId] : undefined;

  const actions = new Set(option.behavior.actions);
  const intents = new Set(option.behavior.intent);
  const independence = character?.personality.independence ?? 50;
  const empathy = character?.personality.empathy ?? 50;

  if (actions.has('support') || actions.has('help') || intents.has('care')) {
    model.caring = clamp(model.caring + 2, 0, 100);
    model.reliability = clamp(model.reliability + 1, 0, 100);
    if (independence >= 75) {
      model.perceivedControl = clamp(model.perceivedControl + 2, 0, 100);
      model.perceivedTraits.overprotective = clamp(
        (model.perceivedTraits.overprotective ?? 0) + 1,
        0,
        100,
      );
    } else {
      model.perceivedTraits.kind = clamp((model.perceivedTraits.kind ?? 50) + 1, 0, 100);
    }
  }

  if (actions.has('chat') || actions.has('ask') || intents.has('connect')) {
    model.perceivedTraits.friendly = clamp((model.perceivedTraits.friendly ?? 50) + 1, 0, 100);
    model.honesty = clamp(model.honesty + 1, 0, 100);
  }

  if (actions.has('challenge') || actions.has('confess') || intents.has('romance')) {
    model.romanticInterest = clamp(model.romanticInterest + 2, 0, 100);
    model.confidence = clamp(model.confidence + 1, 0, 100);
  }

  if (actions.has('observe') || actions.has('wait') || intents.has('respect')) {
    model.perceivedControl = clamp(model.perceivedControl - 1, 0, 100);
    model.perceivedTraits.patient = clamp((model.perceivedTraits.patient ?? 50) + 1, 0, 100);
  }

  const positiveReaction = reaction.emotion
    ? ['relief', 'joy', 'happy', 'affection', 'grateful', 'calm'].includes(
        reaction.emotion.type.toLowerCase(),
      )
    : false;
  if (positiveReaction) {
    model.caring = clamp(model.caring + Math.round(empathy / 50), 0, 100);
    model.perceivedIntentions.care = clamp((model.perceivedIntentions.care ?? 50) + 1, 0, 100);
  }

  return next;
}
