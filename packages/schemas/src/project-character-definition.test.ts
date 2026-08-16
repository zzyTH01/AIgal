import { describe, expect, it } from 'vitest';
import { characterDefinitionSchema } from './character-definition.js';
import { gameProjectSchema, projectPolicySchema } from './project.js';
import { makeCharacterDefinition, makeProject } from './test-data.js';

describe('CharacterDefinition schema', () => {
  it('accepts a valid CharacterDefinition', () => {
    expect(characterDefinitionSchema.safeParse(makeCharacterDefinition()).success).toBe(true);
  });

  it('rejects underage identity and invalid psychology defaults', () => {
    const definition = makeCharacterDefinition();
    definition.identity.age = 17;
    expect(characterDefinitionSchema.safeParse(definition).success).toBe(false);

    definition.identity.age = 19;
    definition.psychologyDefaults.dependence = 101;
    expect(characterDefinitionSchema.safeParse(definition).success).toBe(false);
  });
});

describe('Project schema', () => {
  it('accepts a valid GameProject', () => {
    expect(gameProjectSchema.safeParse(makeProject()).success).toBe(true);
  });

  it('accepts a policy with no mature themes', () => {
    expect(projectPolicySchema.safeParse(makeProject().policy).success).toBe(true);
  });

  it('rejects project with missing world definition', () => {
    const project = makeProject();
    delete (project as { world?: unknown }).world;
    expect(gameProjectSchema.safeParse(project).success).toBe(false);
  });

  it('rejects invalid daily progress limit', () => {
    const project = makeProject();
    project.world.dailyProgressLimit = 0;
    expect(gameProjectSchema.safeParse(project).success).toBe(false);
  });

  it('rejects day 0 start and out-of-range location accessibility', () => {
    const project = makeProject();
    project.world.startDay = 0;
    expect(gameProjectSchema.safeParse(project).success).toBe(false);

    project.world.startDay = 1;
    project.world.locations[0]!.accessibility = 120;
    expect(gameProjectSchema.safeParse(project).success).toBe(false);
  });
});
