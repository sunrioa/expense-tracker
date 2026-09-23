/**
 * 金额运算。
 *
 * 数据库列是 DECIMAL(12,2)，原来 Java 用 BigDecimal 精确计算。
 * JS 的 number 是双精度浮点，直接相加会漂（0.1 + 0.2 !== 0.3），
 * 所以这里一律**换算成整数分再算**，出口再换回元。
 *
 * mysql2 默认把 DECIMAL 读成字符串以免丢精度，parseAmount 负责统一入口。
 */

/** 元 → 分（四舍五入到整数分） */
export function toCents(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** 分 → 元 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** 把任意来源（DECIMAL 字符串 / number / null）解析成 2 位小数的元 */
export function parseAmount(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return fromCents(toCents(n));
}

/** 四舍五入到 2 位小数 */
export function roundAmount(v: number | string | null | undefined): number {
  return fromCents(toCents(v));
}

/** 精确求和：全部转成分相加，再转回元 */
export function sumAmounts(values: Iterable<number | string | null | undefined>): number {
  let cents = 0;
  for (const v of values) cents += toCents(v);
  return fromCents(cents);
}

/** part 占 grand 的百分比，保留 2 位；grand 为 0 时返回 0 */
export function percentOf(part: number, grand: number): number {
  const g = toCents(grand);
  if (g === 0) return 0;
  return Math.round((toCents(part) * 10000) / g) / 100;
}

/** 写库用：DECIMAL(12,2) 接受字符串，避免驱动层再做一次浮点转换 */
export function toDecimalString(v: number | string | null | undefined): string {
  return (toCents(v) / 100).toFixed(2);
}
