import {
  characterDefinitionSchema,
  type CharacterDefinition,
  type CharacterState,
} from '@ag/schemas';
import {
  AG_EXTENSION_KEY,
  type AgCardExtension,
  type STCardData,
  type STCharacterCardV2,
  type STWorldBook,
} from './types.js';

export interface LegacyCardContext {
  defaultCharacterId?: string;
}

/** CharacterDefinition → SillyTavern Character Card V2 JSON。 */
export function definitionToCard(
  definition: CharacterDefinition,
  worldBook?: STWorldBook,
): STCharacterCardV2 {
  const parsed = characterDefinitionSchema.parse(definition);
  const extension: AgCardExtension = { characterDefinition: parsed };
  const data: STCardData = {
    name: parsed.identity.name,
    description: parsed.identity.description || parsed.identity.role,
    personality: formatPersonality(parsed),
    scenario: parsed.identity.description || parsed.identity.role,
    first_mes: parsed.speech.examples[0] ?? '你好。',
    mes_example: parsed.speech.examples.join('\n'),
    creator_notes: formatSecretsAndGoals(parsed),
    system_prompt: '保持角色一致性；输出双通道结构。',
    post_history_instructions:
      parsed.boundaries.length > 0 ? `边界：${parsed.boundaries.join('；')}` : '',
    alternate_greetings: parsed.speech.examples.slice(1),
    tags: [...parsed.preferences.likes, ...parsed.preferences.interests],
    creator: 'tavern-gal',
    character_version: '1.0',
    extensions: { [AG_EXTENSION_KEY]: extension },
    ...(worldBook ? { character_book: worldBook } : {}),
  };

  return { spec: 'chara_card_v2', spec_version: '2.0', data };
}

/** SillyTavern Character Card V2 JSON → CharacterDefinition。 */
export function cardToDefinition(
  card: STCharacterCardV2,
  context: LegacyCardContext = {},
): CharacterDefinition {
  if (card.spec !== 'chara_card_v2') {
    throw new Error(`Unsupported character card spec: ${card.spec}`);
  }

  const extension = card.data.extensions?.[AG_EXTENSION_KEY] as AgCardExtension | undefined;
  if (extension?.characterDefinition) {
    return characterDefinitionSchema.parse(extension.characterDefinition);
  }

  // 无 ag 扩展时，按传统字段保守还原。
  return characterDefinitionSchema.parse({
    schemaVersion: '0.1.0',
    characterId: context.defaultCharacterId ?? sanitizeId(card.data.name),
    identity: {
      name: card.data.name,
      age: 18,
      gender: 'unknown',
      genderIdentity: 'unknown',
      sexualOrientation: 'unknown',
      role: card.data.scenario || 'character',
      description: card.data.description,
    },
    personality: {
      traits: {},
      independence: 50,
      confidence: 50,
      sociability: 50,
      sensitivity: 50,
      assertiveness: 50,
      empathy: 50,
      openness: 50,
    },
    preferences: { likes: card.data.tags, dislikes: [], interests: [] },
    speech: {
      style: card.data.personality,
      tone: 'neutral',
      vocabulary: [],
      examples: [card.data.first_mes, ...card.data.alternate_greetings],
    },
    psychologyDefaults: {
      dependence: 50,
      security: 50,
      loneliness: 50,
      stress: 50,
      jealousy: 50,
      selfWorth: 50,
      emotionalStability: 50,
      romanticTension: 50,
    },
    cognition: {
      memoryCapacity: 80,
      encoding: 60,
      retention: 60,
      retrieval: 60,
      forgetfulness: 30,
      grudge: 30,
      obsession: 30,
      attention: 60,
      emotionalSalience: 60,
      cognitiveLoad: 30,
    },
    relationshipDefaults: { initialType: 'stranger', metrics: {}, tags: [] },
    secrets: [],
    goals: [],
    boundaries: [],
    gameParameters: {},
  });
}

export function definitionToGameCharacter(definition: CharacterDefinition): CharacterState {
  const parsed = characterDefinitionSchema.parse(definition);
  return {
    characterId: parsed.characterId,
    identity: parsed.identity,
    personality: parsed.personality,
    psychology: parsed.psychologyDefaults,
    emotion: { primary: 'neutral', intensity: 30, valence: 0, energy: 50 },
    cognition: parsed.cognition,
    physical: { energy: 70, fatigue: 20, health: 90, hunger: 20, sleepiness: 10 },
    activity: {
      locationId: 'loc_start',
      activity: 'idle',
      availability: 100,
      currentGoal: parsed.goals[0]?.description,
    },
    status: 'active',
  } satisfies CharacterState;
}

function formatPersonality(definition: CharacterDefinition): string {
  const p = definition.personality;
  return [
    `traits: ${Object.entries(p.traits)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
    `independence=${p.independence}, confidence=${p.confidence}, sociability=${p.sociability}`,
    `sensitivity=${p.sensitivity}, assertiveness=${p.assertiveness}, empathy=${p.empathy}, openness=${p.openness}`,
    `likes: ${definition.preferences.likes.join('、')}`,
    `dislikes: ${definition.preferences.dislikes.join('、')}`,
    `speech: ${definition.speech.style}/${definition.speech.tone}`,
  ].join('\n');
}

function formatSecretsAndGoals(definition: CharacterDefinition): string {
  const secrets = definition.secrets.map((secret) => `secret:${secret.content}`).join('\n');
  const goals = definition.goals.map((goal) => `goal:${goal.description}`).join('\n');
  return [secrets, goals].filter(Boolean).join('\n');
}

function sanitizeId(name: string): string {
  return name.trim() || 'character';
}
