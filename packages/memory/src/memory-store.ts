import {
  memoryRecordSchema,
  type MemoryId,
  type MemoryRecord,
  type MemoryState,
} from '@ag/schemas';

/**
 * MemoryStore 持有 records + short/long/forgotten 三层索引。
 * 本类不直接改 GameState；返回新的 MemoryState，由调用方写回。
 */
export class MemoryStore {
  private memory: MemoryState;

  constructor(initial: MemoryState) {
    this.memory = structuredClone(initial);
  }

  static fromMemoryState(initial: MemoryState): MemoryStore {
    return new MemoryStore(initial);
  }

  snapshot(): MemoryState {
    return structuredClone(this.memory);
  }

  get(memoryId: MemoryId): MemoryRecord | undefined {
    return this.memory.records[memoryId];
  }

  add(record: MemoryRecord): MemoryState {
    const parsed = memoryRecordSchema.parse(record);
    this.memory.records[parsed.id] = parsed;
    this.addUnique(this.memory.shortTermIds, parsed.id);
    this.memory.forgottenIds = this.memory.forgottenIds.filter((id) => id !== parsed.id);
    return this.snapshot();
  }

  moveToLongTerm(memoryId: MemoryId): MemoryState {
    if (!this.memory.records[memoryId]) {
      throw new Error(`Unknown memoryId: ${memoryId}`);
    }
    this.memory.shortTermIds = this.memory.shortTermIds.filter((id) => id !== memoryId);
    this.addUnique(this.memory.longTermIds, memoryId);
    this.memory.forgottenIds = this.memory.forgottenIds.filter((id) => id !== memoryId);
    return this.snapshot();
  }

  forget(memoryId: MemoryId): MemoryState {
    if (!this.memory.records[memoryId]) {
      throw new Error(`Unknown memoryId: ${memoryId}`);
    }
    this.memory.shortTermIds = this.memory.shortTermIds.filter((id) => id !== memoryId);
    this.memory.longTermIds = this.memory.longTermIds.filter((id) => id !== memoryId);
    this.addUnique(this.memory.forgottenIds, memoryId);
    return this.snapshot();
  }

  activeRecords(): MemoryRecord[] {
    return Object.entries(this.memory.records)
      .filter(([id]) => !this.memory.forgottenIds.includes(id))
      .map(([, record]) => record);
  }

  private addUnique(target: string[], value: string): void {
    if (!target.includes(value)) target.push(value);
  }
}
