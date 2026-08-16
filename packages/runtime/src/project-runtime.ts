import { gameProjectSchema, type GameProject } from '@ag/schemas';
import type { RuntimeConfig } from './game-runtime.js';

/** Design → Play：Project 包直接转为 RuntimeConfig。 */
export function projectToRuntimeConfig(project: GameProject): RuntimeConfig {
  const parsed = gameProjectSchema.parse(project);
  const character = parsed.characters[0];
  if (!character) {
    throw new Error('Project must contain at least one CharacterDefinition');
  }
  return {
    character,
    eventDefinitions: parsed.events,
    policy: parsed.policy,
  };
}
