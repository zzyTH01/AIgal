import { gameProjectSchema, type GameProject } from '@ag/schemas';
import { demoCharacter } from '@ag/runtime';

export function createBlankProject(overrides: Partial<GameProject> = {}): GameProject {
  return gameProjectSchema.parse({
    schemaVersion: '0.1.0',
    projectId: 'project_designer',
    name: '未命名项目',
    version: '0.1.0',
    description: '',
    policy: {
      ageRating: 'all_ages',
      relationshipTypes: ['stranger', 'acquaintance', 'friend'],
      contentTags: [],
      narrativeTone: 'gentle',
      matureThemes: [],
      generationConstraints: {},
    },
    characters: [structuredClone(demoCharacter)],
    world: {
      worldId: 'world_designer',
      name: '未命名世界',
      description: '',
      dailyProgressLimit: 12,
      startDay: 1,
      startTime: '09:00',
      startWeekday: 'monday',
      startSeason: 'spring',
      locations: [
        {
          locationId: 'loc_start',
          name: '起点',
          type: 'hub',
          tags: [],
          accessibility: 100,
          description: '默认地点',
        },
      ],
      initialWorldFlags: {},
    },
    parameters: { dayLength: 12 },
    optionTemplates: [],
    events: [],
    endings: [],
    prompts: {},
    assets: {},
    ...overrides,
  });
}

export function exportProjectJson(project: GameProject): string {
  return `${JSON.stringify(gameProjectSchema.parse(project), null, 2)}\n`;
}

export function importProjectJson(json: string): GameProject {
  return gameProjectSchema.parse(JSON.parse(json));
}
