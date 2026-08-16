import { rngStateSchema, type RNGState } from '@ag/schemas';
import type { RNG } from '@ag/core';

const UINT32_MAX = 0xffffffff;
const DEFAULT_SEED_STATE = 0x9e3779b9;

/**
 * xorshift128 可复现 RNG。
 * save()/fromState() 与 `RNGState { seed, state, algorithm }` 数据契约对齐，
 * 供 Debug/Replay/Golden Test 使用。
 */
export class XorShift128Rng implements RNG {
  private readonly originalSeed: number;
  private s: [number, number, number, number];

  constructor(seed: number) {
    const normalized = Math.trunc(seed) >>> 0;
    this.originalSeed = normalized;
    const a = normalized === 0 ? DEFAULT_SEED_STATE : normalized;
    const b = (a ^ 0x6d2b79f5) >>> 0;
    const c = (a ^ 0xa5a5a5a5) >>> 0;
    const d = (a ^ 0x5a5a5a5a) >>> 0;
    this.s = [a, b, c, d];
  }

  nextUint32(): number {
    let t = this.s[0];
    const x = this.s[3];

    this.s[0] = this.s[1] >>> 0;
    this.s[1] = this.s[2] >>> 0;
    this.s[2] = this.s[3] >>> 0;

    t ^= (t << 11) & UINT32_MAX;
    t ^= t >>> 8;
    this.s[3] = (t ^ x ^ (x >>> 19)) >>> 0;
    return this.s[3];
  }

  /** 返回 [0, 1) 均匀浮点数。 */
  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** 返回 [min, max) 的整数。 */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  save(): RNGState {
    return rngStateSchema.parse({
      seed: this.originalSeed,
      state: [...this.s],
      algorithm: 'xorshift128',
    });
  }

  static fromState(state: RNGState): XorShift128Rng {
    const parsed = rngStateSchema.parse(state);
    if (parsed.algorithm !== 'xorshift128') {
      throw new Error(`Unsupported RNG algorithm: ${parsed.algorithm}`);
    }
    if (parsed.state.length !== 4) {
      throw new Error('xorshift128 state must contain exactly 4 uint32 values');
    }
    const rng = new XorShift128Rng(parsed.seed);
    rng.s = [parsed.state[0]!, parsed.state[1]!, parsed.state[2]!, parsed.state[3]!];
    return rng;
  }
}

export function createSeededRng(seed: number): XorShift128Rng {
  return new XorShift128Rng(seed);
}
