import { describe, expect, it } from 'vitest';
import {
  characterIdentitySchema,
  characterStateSchema,
  cognitionStateSchema,
} from './character.js';
import { relationshipStateSchema } from './relationship.js';
import { worldStateSchema } from './world.js';
import { makeCharacterState, makeRelationshipState, makeWorldState } from './test-data.js';

describe('CharacterState schema', () => {
  it('accepts a valid character state', () => {
    expect(characterStateSchema.safeParse(makeCharacterState()).success).toBe(true);
  });

  it('rejects underage characters (age < 18)', () => {
    const data = makeCharacterState();
    data.identity.age = 17;
    expect(characterIdentitySchema.safeParse(data.identity).success).toBe(false);
    expect(characterStateSchema.safeParse(data).success).toBe(false);
  });

  it('rejects out-of-range psychology values', () => {
    const data = makeCharacterState();
    data.psychology.stress = 101;
    expect(characterStateSchema.safeParse(data).success).toBe(false);
  });

  it('rejects out-of-range cognition values', () => {
    const data = makeCharacterState();
    data.cognition.memoryCapacity = -1;
    expect(cognitionStateSchema.safeParse(data).success).toBe(false);
    expect(characterStateSchema.safeParse(data).success).toBe(false);
  });
});

describe('RelationshipState schema', () => {
  it('accepts a valid relationship', () => {
    expect(relationshipStateSchema.safeParse(makeRelationshipState()).success).toBe(true);
  });

  it('rejects unknown relationship type and out-of-range metrics', () => {
    const data = makeRelationshipState();
    data.type = 'soulmate' as never;
    expect(relationshipStateSchema.safeParse(data).success).toBe(false);

    data.type = 'friend';
    data.affection = -0.1;
    expect(relationshipStateSchema.safeParse(data).success).toBe(false);
  });
});

describe('WorldState schema', () => {
  it('accepts a valid world state', () => {
    expect(worldStateSchema.safeParse(makeWorldState()).success).toBe(true);
  });

  it('rejects invalid time and weather visibility', () => {
    const data = makeWorldState();
    data.time = '9:00';
    expect(worldStateSchema.safeParse(data).success).toBe(false);

    data.time = '09:00';
    data.weather.visibility = 120;
    expect(worldStateSchema.safeParse(data).success).toBe(false);
  });

  it('rejects missing location name/id and out-of-range accessibility', () => {
    const data = makeWorldState();
    delete (data.locations.loc_library as { name?: unknown }).name;
    expect(worldStateSchema.safeParse(data).success).toBe(false);

    delete (data.locations.loc_library as { locationId?: unknown }).locationId;
    expect(worldStateSchema.safeParse(data).success).toBe(false);

    data.locations.loc_library!.locationId = 'loc_library';
    data.locations.loc_library!.name = '图书馆';
    data.locations.loc_library!.accessibility = 120;
    expect(worldStateSchema.safeParse(data).success).toBe(false);
  });
});
