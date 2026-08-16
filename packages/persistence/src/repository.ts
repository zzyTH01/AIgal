/** 存档仓库端口。浏览器可用 Memory 实现；Node 可用 JSON Directory 实现。 */
export interface SaveRepository {
  save(saveId: string, snapshot: unknown): Promise<void>;
  load<T = unknown>(saveId: string): Promise<T>;
  list(): Promise<string[]>;
  delete(saveId: string): Promise<void>;
}

export class MemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<string, unknown>();

  async save(saveId: string, snapshot: unknown): Promise<void> {
    this.saves.set(saveId, structuredClone(snapshot));
  }

  async load<T = unknown>(saveId: string): Promise<T> {
    const snapshot = this.saves.get(saveId);
    if (!snapshot) throw new Error(`Unknown saveId: ${saveId}`);
    return structuredClone(snapshot) as T;
  }

  async list(): Promise<string[]> {
    return [...this.saves.keys()];
  }

  async delete(saveId: string): Promise<void> {
    this.saves.delete(saveId);
  }
}
