import {
  characterDefinitionSchema,
  type CharacterDefinition,
  type CharacterState,
} from '@ag/schemas';
import { definitionToCard, cardToDefinition, definitionToGameCharacter } from './character-card.js';
import { definitionToWorldBook } from './world-book.js';
import type { STCharacterCardV2, STWorldBook } from './types.js';

export interface CompiledCharacter {
  definition: CharacterDefinition;
  card: STCharacterCardV2;
  worldBook: STWorldBook;
  prompt: string;
  gameCharacter: CharacterState;
}

export interface CharacterCompiler {
  compile(definition: CharacterDefinition): CompiledCharacter;
  parseCard(card: STCharacterCardV2): CharacterDefinition;
}

export function compileCharacter(definition: CharacterDefinition): CompiledCharacter {
  const parsed = characterDefinitionSchema.parse(definition);
  const worldBook = definitionToWorldBook(parsed);
  const card = definitionToCard(parsed, worldBook);
  const gameCharacter = definitionToGameCharacter(parsed);
  const prompt = [
    `[System]\n${card.data.system_prompt}`,
    `[Personality]\n${card.data.personality}`,
    `[First Message]\n${card.data.first_mes}`,
    `[Boundaries]\n${card.data.post_history_instructions || '（无）'}`,
  ].join('\n\n');

  return { definition: parsed, card, worldBook, prompt, gameCharacter };
}

export function parseCompiledCard(card: STCharacterCardV2): CharacterDefinition {
  return cardToDefinition(card);
}

export const characterCompiler: CharacterCompiler = Object.freeze({
  compile: compileCharacter,
  parseCard: parseCompiledCard,
});
