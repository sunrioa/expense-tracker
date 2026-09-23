import { currentPeriod, type Period } from '@ledger/shared';

/**
 * 展示用的格式化。金额运算（求和、取整）一律走 @ledger/shared，
 * 这里只管「怎么显示」。
 */

type Numeric = number | string | null | undefined;

const fmt2 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });

/** 6839.65 → 6,839.65 */
export const money = (v: Numeric): string => fmt2.format(Number(v || 0));

/** 6839.65 → ¥6,839.65 */
export const yuan = (v: Numeric): string => `¥${money(v)}`;

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

/** 坐标轴、小标签上的紧凑写法：860 / 8,600 / 1.2万 / 3.5亿 */
export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e8) return `${oneDecimal(v / 1e8)}亿`;
  if (a >= 1e4) return `${oneDecimal(v / 1e4)}万`;
  return fmt0.format(Math.round(v));
}

/** 占比，保留一位小数；极小但非零时不显示成 0% */
export function percent(part: number, total: number): string {
  if (!total || !part) return '0%';
  const p = (part / total) * 100;
  if (p < 0.1) return '<0.1%';
  return `${oneDecimal(p)}%`;
}

function parts(p: Period): [number, number] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** 2026-09 → 2026年9月 */
export function monthLabel(p: Period): string {
  const x = parts(p);
  return x ? `${x[0]}年${x[1]}月` : p;
}

/** 2026-09 → 9月 */
export function monthShort(p: Period): string {
  const x = parts(p);
  return x ? `${x[1]}月` : p;
}

/** 今年的月份省掉年份：2026-09 → 9月，2025-12 → 2025年12月 */
export function monthSmart(p: Period, now: Period = currentPeriod()): string {
  return p.slice(0, 4) === now.slice(0, 4) ? monthShort(p) : monthLabel(p);
}

/** 月份区间的标签：同一年合并年份 —— 2026年1月 – 9月 */
export function rangeLabel(from: Period, to: Period): string {
  if (from === to) return monthLabel(from);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${monthLabel(from)} – ${monthShort(to)}`;
  return `${monthLabel(from)} – ${monthLabel(to)}`;
}
