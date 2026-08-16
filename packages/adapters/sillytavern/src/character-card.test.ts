import { describe, expect, it } from 'vitest';
import { cardToDefinition, definitionToCard } from './character-card.js';
import { makeDefinition } from './test-data.js';

describe('Character Card generation/parsing', () => {
  it('round-trips CharacterDefinition through ST Card V2 extension', () => {
    const definition = makeDefinition();
    const card = definitionToCard(definition);
    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.name).toBe('Mio');
    expect(card.data.first_mes).toBe('……嗯。');

    const parsed = cardToDefinition(card);
    expect(parsed).toEqual(definition);
  });

  it('falls back to legacy card fields without ag extension', () => {
    const card = definitionToCard(makeDefinition());
    delete card.data.extensions.ag;
    const parsed = cardToDefinition(card);
    expect(parsed.identity.name).toBe('Mio');
    expect(parsed.speech.examples).toContain('……嗯。');
  });
});
