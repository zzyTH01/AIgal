/**
 * Phase 3 使用的 RNG 端口。next() 返回 [0, 1) 均匀随机数。
 * Phase 4 将提供可 save/restore 的 xorshift128 实现。
 */
export interface RNG {
  next(): number;
}

/** 无风险/测试用：永远返回 0（在 `next() < 1 - risk` 语义下即永远成功）。 */
export const ALWAYS_SUCCESS_RNG: RNG = Object.freeze({
  next: () => 0,
});
