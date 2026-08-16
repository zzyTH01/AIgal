import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { gameStateSchema } from './game-state.js';
import { makeGameState } from './test-data.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(srcDir, '../schemas');

const expectedFiles = [
  'game-state.schema.json',
  'character.schema.json',
  'relationship.schema.json',
  'option.schema.json',
  'event.schema.json',
  'state-delta.schema.json',
  'turn-result.schema.json',
  'context.schema.json',
  'memory.schema.json',
  'save.schema.json',
  'project.schema.json',
  'character-definition.schema.json',
];

describe('generated JSON Schema files', () => {
  it('contains all required JSON Schema files', async () => {
    const files = await readdir(schemasDir);
    for (const expected of expectedFiles) {
      expect(files).toContain(expected);
    }
  });

  it('emits valid JSON with Draft 2020-12 $schema', async () => {
    for (const file of expectedFiles) {
      const text = await readFile(resolve(schemasDir, file), 'utf8');
      const schema = JSON.parse(text) as {
        $schema?: string;
        type?: string;
        anyOf?: unknown[];
      };
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.type === 'object' || Array.isArray(schema.anyOf)).toBe(true);
    }
  });

  it('keeps GameState JSON Schema aligned with Zod required root keys', async () => {
    const text = await readFile(resolve(schemasDir, 'game-state.schema.json'), 'utf8');
    const schema = JSON.parse(text) as { required?: string[] };
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'run',
        'world',
        'characters',
        'relationships',
        'flags',
        'playerModel',
        'memories',
        'meta',
        'rng',
      ]),
    );
  });

  it('compiles every generated schema with Ajv Draft 2020-12', async () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
    for (const file of expectedFiles) {
      const text = await readFile(resolve(schemasDir, file), 'utf8');
      expect(() => ajv.compile(JSON.parse(text) as object)).not.toThrow();
    }
  });

  it('accepts the same valid GameState as Zod', async () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
    const text = await readFile(resolve(schemasDir, 'game-state.schema.json'), 'utf8');
    const validate = ajv.compile(JSON.parse(text) as object);
    const gameState = makeGameState();
    expect(gameStateSchema.safeParse(gameState).success).toBe(true);
    expect(validate(gameState)).toBe(true);
  });
});
