/* global console */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateJsonSchemas } from '../dist/index.js';

const schemasDir = resolve(dirname(fileURLToPath(import.meta.url)), '../schemas');
await mkdir(schemasDir, { recursive: true });

for (const [fileName, schema] of Object.entries(generateJsonSchemas())) {
  await writeFile(resolve(schemasDir, fileName), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
}

console.log(
  `Generated ${Object.keys(generateJsonSchemas()).length} JSON Schema files in ${schemasDir}`,
);
