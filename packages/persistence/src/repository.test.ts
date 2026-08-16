import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonDirectorySaveRepository } from './json-directory.js';
import { MemorySaveRepository } from './repository.js';

describe('SaveRepository', () => {
  it('MemorySaveRepository round-trips snapshots', async () => {
    const repo = new MemorySaveRepository();
    await repo.save('save_1', { day: 1 });
    expect(await repo.load('save_1')).toEqual({ day: 1 });
    expect(await repo.list()).toEqual(['save_1']);
  });

  it('JsonDirectorySaveRepository writes manifest and state files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tavern-saves-'));
    const repo = new JsonDirectorySaveRepository({ baseDir: dir });
    await repo.save('run_017', { day: 2, turn: 5 });
    expect(await repo.list()).toEqual(['run_017']);
    expect(await repo.load('run_017')).toEqual({ day: 2, turn: 5 });
    const manifest = JSON.parse(await readFile(join(dir, 'run_017', 'manifest.json'), 'utf8'));
    expect(manifest.saveId).toBe('run_017');
    await repo.delete('run_017');
    expect(await repo.list()).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });
});
