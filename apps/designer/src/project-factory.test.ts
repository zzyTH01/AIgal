import { describe, expect, it } from 'vitest';
import { gameProjectSchema } from '@ag/schemas';
import { createBlankProject, exportProjectJson, importProjectJson } from './project-factory.js';

describe('Designer project package round-trip', () => {
  it('creates, exports and imports a valid GameProject', () => {
    const project = createBlankProject({ name: '测试项目' });
    expect(gameProjectSchema.safeParse(project).success).toBe(true);

    const json = exportProjectJson(project);
    const imported = importProjectJson(json);
    expect(imported.name).toBe('测试项目');
    expect(imported).toEqual(project);
  });

  it('rejects invalid imported JSON', () => {
    expect(() => importProjectJson('{"name":"missing"}')).toThrow();
  });
});
