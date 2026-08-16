import {
  characterDefinitionSchema,
  type CharacterDefinition,
  type WorldDefinition,
} from '@ag/schemas';
import type { STWorldBook, STWorldBookEntry } from './types.js';

export function definitionToWorldBook(definition: CharacterDefinition): STWorldBook {
  const parsed = characterDefinitionSchema.parse(definition);
  const entries: Record<string, STWorldBookEntry> = {};
  let uid = 1;

  const add = (comment: string, keys: string[], content: string, constant = false): void => {
    entries[`entry_${uid}`] = {
      uid,
      comment,
      enabled: true,
      constant,
      selective: false,
      position: 'before_char',
      depth: 2,
      order: 100 + uid,
      keys,
      content,
      extensions: {},
    };
    uid += 1;
  };

  add(
    'identity',
    [parsed.identity.name],
    parsed.identity.description || parsed.identity.role,
    true,
  );
  add(
    'preferences',
    [...parsed.preferences.likes, ...parsed.preferences.dislikes],
    `喜欢：${parsed.preferences.likes.join('、')}；讨厌：${parsed.preferences.dislikes.join('、')}`,
    true,
  );
  add('boundaries', parsed.boundaries, `边界：${parsed.boundaries.join('；')}`, true);

  for (const secret of parsed.secrets) {
    add(
      `secret:${secret.id}`,
      [secret.id, 'secret'],
      `${secret.content}（揭示条件：${secret.revealCondition}）`,
    );
  }
  for (const goal of parsed.goals) {
    add(`goal:${goal.id}`, [goal.id, 'goal'], goal.description);
  }

  return { entries };
}

export function worldBookToEntries(worldBook: STWorldBook): STWorldBookEntry[] {
  return Object.values(worldBook.entries).sort((a, b) => a.order - b.order || a.uid - b.uid);
}

export function worldDefinitionToWorldBook(world: WorldDefinition): STWorldBook {
  const entries: Record<string, STWorldBookEntry> = {};
  for (const location of world.locations) {
    entries[`loc_${location.locationId}`] = {
      uid: 1000 + world.locations.indexOf(location),
      comment: `location:${location.locationId}`,
      enabled: true,
      constant: true,
      selective: false,
      position: 'before_char',
      depth: 1,
      order: 900 + world.locations.indexOf(location),
      keys: [location.locationId, location.name, location.type],
      content: `${location.name}：${location.description}（类型 ${location.type}，可及性 ${location.accessibility}）`,
      extensions: {},
    };
  }
  return { entries };
}
