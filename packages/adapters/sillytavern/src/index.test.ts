import { describe, expect, it } from 'vitest';
import { compileCharacter } from './index.js';
import { makeDefinition } from './test-data.js';

describe('@ag/st-adapter package entry', () => {
  it('compiles a CharacterDefinition', () => {
    expect(compileCharacter(makeDefinition()).card.data.name).toBe('Mio');
  });
});
