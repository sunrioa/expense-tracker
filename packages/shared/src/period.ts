/**
 * 月份工具。前后端共用，保证「什么是合法月份」只有一个定义。
 *
 * 对应原 backend/src/main/java/com/ledger/common/Periods.java。
 */

/** 月份，格式 yyyy-MM，如 "2026-09" */
export type Period = string;

/** 月份格式非法。服务端会把它映射成 400，而不是 500。 */
export class InvalidPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPeriodError';
  }
}

/** 接受 2026-9 / 2026/09 / 202609 / 2026年9月 等写法 */
const RAW = /^(\d{4})[-/.]?(\d{1,2})$/;

/**
 * 归一化为 yyyy-MM。空白返回 undefined，格式非法抛 InvalidPeriodError。
 *
 * 返回 undefined 而不是 null：响应里「缺席」用 undefined 表达，
 * JSON.stringify 会自动把它丢掉，和原来 Jackson 的 non_null 行为一致。
 */
export function normalizePeriod(raw: string | null | undefined): Period | undefined {
  if (raw === null || raw === undefined || raw.trim() === '') return undefined;
  const t = raw.trim().replaceAll('年', '-').replaceAll('月', '');
  const m = RAW.exec(t);
  if (!m) throw new InvalidPeriodError(`月份格式不正确，应为 yyyy-MM：${raw}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new InvalidPeriodError(`月份不合法：${raw}`);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** 当前月份 */
export function currentPeriod(): Period {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 2026-09 → 2026年09月。用于图表轴和表格标签。 */
export function periodLabelCN(period: Period | null | undefined): string {
  if (!period) return '未知月份';
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  return m ? `${m[1]}年${m[2]}月` : period;
}

/** 从 yyyy-MM 取年份；取不到返回 0（与 Java 版 yearOf 的兜底一致） */
export function yearOf(period: Period | null | undefined): number {
  if (!period) return 0;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  return m ? Number(m[1]) : 0;
}

/** 区间内连续月份列表（含两端）。from/to 缺失时返回空数组。 */
export function periodRange(
  from: Period | null | undefined,
  to: Period | null | undefined
): Period[] {
  if (!from || !to) return [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  if (!fy || !fm || !ty || !tm) return [];

  const out: Period[] = [];
  let y = fy;
  let mo = fm;
  // 上限兜底，避免非法输入把循环跑飞
  for (let guard = 0; guard < 10000; guard++) {
    if (y > ty || (y === ty && mo > tm)) break;
    out.push(`${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`);
    mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
  }
  return out;
}

/** period 是否落在 [from, to] 内。yyyy-MM 的字典序等价于时间序，直接比字符串。 */
export function inPeriodRange(
  period: Period | null | undefined,
  from?: Period,
  to?: Period
): boolean {
  if (!period) return false;
  if (from && period < from) return false;
  return !to || period <= to;
}
