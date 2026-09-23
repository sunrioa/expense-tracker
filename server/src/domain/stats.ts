import {
  inPeriodRange,
  percentOf,
  periodLabelCN,
  periodRange,
  sumAmounts,
  yearOf
} from '@ledger/shared';
import type { Granularity, NameStat, PeriodStat, StatsResponse } from '@ledger/shared';
import { indexById, parentIdSet, topCategoryOf } from './tree';
import type { ExpenseRow } from './types';

/**
 * 饼图 / 排行配色。
 *
 * 这份颜色由服务端下发，前端浅色 / 深色两种模式都直接用它，所以每个色都必须
 * 在白底和近黑底上同时读得出来 —— 统一取中间调（相对亮度大致落在 0.15~0.55），
 * 不用 700 以上的深色（深底上会糊）也不用 300 以下的浅色（白底上会飘）。
 * stats.test.ts 里有一条测试守着这个区间。
 */
export const PALETTE = [
  '#14b8a6', // 青绿 —— 主色family
  '#f97316', // 陶土橙
  '#84cc16', // 橄榄绿
  '#0ea5e9', // 青蓝
  '#eab308', // 琥珀
  '#f43f5e', // 绛红
  '#10b981', // 翠绿
  '#d97706', // 深琥珀
  '#06b6d4', // 浅青
  '#65a30d', // 深橄榄
  '#fb923c', // 浅陶土
  '#0284c7', // 深青蓝
  '#e11d48', // 深绛红
  '#22c55e', // 草绿
  '#a16207' // 黄褐
] as const;

export interface StatsInput {
  from?: string;
  to?: string;
  granularity?: string;
}

/**
 * 统计聚合。
 *
 * 只统计叶子节点 —— 父项是分组容器，参与累加会导致父子重复计算。
 */
export function computeStats(rows: ExpenseRow[], input: StatsInput = {}): StatsResponse {
  // 原 Java 版是「不等于 year 就按 month」，保持这个宽容行为
  const granularity: Granularity = input.granularity?.toLowerCase() === 'year' ? 'year' : 'month';
  const { from, to } = input;

  const byId = indexById(rows);
  const parents = parentIdSet(rows);
  const leaves = rows.filter(
    (r) => !parents.has(r.id) && ((!from && !to) || inPeriodRange(r.period, from, to))
  );

  const empty: StatsResponse = {
    granularity,
    fromPeriod: from,
    toPeriod: to,
    total: 0,
    recordCount: 0,
    monthCount: 0,
    avgPerMonth: 0,
    maxAmount: 0,
    byName: [],
    byCategory: [],
    byPeriod: []
  };
  if (leaves.length === 0) return empty;

  const total = sumAmounts(leaves.map((r) => r.amount));

  const months = [...new Set(leaves.map((r) => r.period).filter(Boolean))].sort();
  const monthCount = months.length;
  const avgPerMonth =
    monthCount === 0 ? 0 : Math.round((total * 100) / monthCount) / 100;

  // 取最大单笔。并列时保留先出现的那条，与 Java 的 Stream.max 行为一致
  let maxRec: ExpenseRow | undefined;
  for (const r of leaves) if (!maxRec || r.amount > maxRec.amount) maxRec = r;

  // 未指定区间时，用数据自身的范围回填，让图表轴有明确起止
  const effectiveFrom = from ?? months[0];
  const effectiveTo = to ?? months[months.length - 1];

  return {
    granularity,
    fromPeriod: effectiveFrom,
    toPeriod: effectiveTo,
    total,
    recordCount: leaves.length,
    monthCount,
    avgPerMonth,
    maxAmount: maxRec?.amount ?? 0,
    maxAmountName: maxRec?.name,
    maxAmountPeriod: maxRec?.period,
    byName: groupToNameStats(leaves, (r) => r.name || '未命名', total),
    byCategory: groupToNameStats(leaves, (r) => topCategoryOf(r, byId), total),
    byPeriod: buildPeriodStats(leaves, effectiveFrom, effectiveTo, granularity, total)
  };
}

/** 按 key 分组求和，按金额倒序，然后依次配色 */
function groupToNameStats(
  leaves: ExpenseRow[],
  keyOf: (r: ExpenseRow) => string,
  grand: number
): NameStat[] {
  // Map 保持插入顺序 —— 金额并列时，排序是稳定的，先出现的排前面
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of leaves) {
    const k = keyOf(r);
    totals.set(k, sumAmounts([totals.get(k) ?? 0, r.amount]));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const list: NameStat[] = [...totals.entries()].map(([name, t]) => ({
    name,
    total: t,
    count: counts.get(name) ?? 0,
    percent: percentOf(t, grand),
    color: ''
  }));
  list.sort((a, b) => b.total - a.total);
  list.forEach((it, i) => {
    it.color = PALETTE[i % PALETTE.length]!;
  });
  return list;
}

/** 按月 / 按年分桶。先铺满整个区间（含没有数据的月份），让折线和柱状图连续。 */
function buildPeriodStats(
  leaves: ExpenseRow[],
  from: string | undefined,
  to: string | undefined,
  granularity: Granularity,
  grandTotal: number
): PeriodStat[] {
  const buckets = new Map<string, PeriodStat>();

  const ensure = (key: string, label: string): PeriodStat => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, total: 0, count: 0, percent: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  if (from && to) {
    if (granularity === 'year') {
      for (let y = yearOf(from); y <= yearOf(to); y++) ensure(String(y), `${y}年`);
    } else {
      for (const m of periodRange(from, to)) ensure(m, periodLabelCN(m));
    }
  }

  for (const r of leaves) {
    if (!r.period || r.period.trim() === '') continue;
    const key = granularity === 'year' ? String(yearOf(r.period)) : r.period;
    const b = ensure(key, granularity === 'year' ? `${key}年` : periodLabelCN(key));
    b.total = sumAmounts([b.total, r.amount]);
    b.count += 1;
  }

  const list = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // 区间内合计为 0 时退化成用分桶自身的和做分母，避免百分比全是 0
  const grand = grandTotal === 0 ? sumAmounts(list.map((b) => b.total)) : grandTotal;
  for (const b of list) b.percent = percentOf(b.total, grand);
  return list;
}
