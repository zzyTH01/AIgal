import { describe, expect, it } from 'vitest';
import { characterCompiler, compileCharacter } from './character-compiler.js';
import { makeDefinition } from './test-data.js';

describe('Character Compiler', () => {
  it('compiles Card + WorldBook + Prompt + GameCharacter and round-trips', () => {
    const definition = makeDefinition();
    const compiled = compileCharacter(definition);
    expect(compiled.card.spec).toBe('chara_card_v2');
    expect(Object.keys(compiled.worldBook.entries).length).toBeGreaterThan(0);
    expect(compiled.prompt).toContain('[System]');
    expect(compiled.gameCharacter.identity.name).toBe('Mio');

    const reparsed = characterCompiler.parseCard(compiled.card);
    expect(reparsed).toEqual(definition);
  });
});
