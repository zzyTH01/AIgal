import jsonSchema from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import { characterDefinitionSchema } from './character-definition.js';
import { characterStateSchema } from './character.js';
import { modelContextSchema } from './context.js';
import { eventDefinitionSchema, eventInstanceSchema } from './event.js';
import { gameStateSchema } from './game-state.js';
import { memoryRecordSchema, memoryStateSchema } from './memory.js';
import { optionSchema } from './option.js';
import { gameProjectSchema } from './project.js';
import { relationshipStateSchema } from './relationship.js';
import { saveSnapshotSchema } from './save.js';
import { stateDeltaSchema } from './state-delta.js';
import { turnResultSchema } from './turn-result.js';

/** 每个 JSON Schema 文件对应的源 Zod Schema。同一来源保证类型/运行时/JSON Schema 一致。 */
export const jsonSchemaRegistry: Readonly<Record<string, ZodType>> = {
  'game-state': gameStateSchema,
  character: characterStateSchema,
  relationship: relationshipStateSchema,
  option: optionSchema,
  event: eventDefinitionSchema,
  'event-instance': eventInstanceSchema,
  'state-delta': stateDeltaSchema,
  'turn-result': turnResultSchema,
  context: modelContextSchema,
  memory: memoryStateSchema,
  'memory-record': memoryRecordSchema,
  save: saveSnapshotSchema,
  project: gameProjectSchema,
  'character-definition': characterDefinitionSchema,
};

function normalizeDraft2020(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(normalizeDraft2020);
  }
  if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.exclusiveMinimum === true && typeof record.minimum === 'number') {
      record.exclusiveMinimum = record.minimum;
      delete record.minimum;
    }
    if (record.exclusiveMaximum === true && typeof record.maximum === 'number') {
      record.exclusiveMaximum = record.maximum;
      delete record.maximum;
    }
    for (const [key, value] of Object.entries(record)) {
      record[key] = normalizeDraft2020(value);
    }
    return record;
  }
  return node;
}

export function generateJsonSchemas(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(jsonSchemaRegistry).map(([name, schema]) => [
      `${name}.schema.json`,
      normalizeDraft2020({
        ...jsonSchema(schema, { target: 'jsonSchema2019-09', $refStrategy: 'none' }),
        $schema: 'https://json-schema.org/draft/2020-12/schema',
      }),
    ]),
  );
}
