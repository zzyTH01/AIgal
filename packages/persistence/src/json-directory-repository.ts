import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SaveRepository } from './repository.js';

export interface JsonDirectoryRepositoryOptions {
  baseDir?: string;
}

/**
 * V1 JSON Directory 落盘（Master Design §5.8）：
 * <baseDir>/<saveId>/{manifest.json,state.json}
 */
export class JsonDirectorySaveRepository implements SaveRepository {
  readonly baseDir: string;

  constructor(options: JsonDirectoryRepositoryOptions = {}) {
    this.baseDir = options.baseDir ?? 'saves';
  }

  async save(saveId: string, snapshot: unknown): Promise<void> {
    const dir = this.saveDir(saveId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'manifest.json'),
      `${JSON.stringify({ saveId, savedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(join(dir, 'state.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  async load<T = unknown>(saveId: string): Promise<T> {
    const text = await readFile(join(this.saveDir(saveId), 'state.json'), 'utf8');
    return JSON.parse(text) as T;
  }

  async list(): Promise<string[]> {
    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async delete(saveId: string): Promise<void> {
    await rm(this.saveDir(saveId), { recursive: true, force: true });
  }

  private saveDir(saveId: string): string {
    return join(this.baseDir, saveId);
  }
}

export function ensureParentDir(filePath: string): void {
  void dirname(filePath);
}
