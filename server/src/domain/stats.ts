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
 * 要求：相邻色差明显，且在浅色和深色两种背景上都读得出来，
 * 所以统一取中间调（约 600 级），不用过深或过浅的色。
 */
export const PALETTE = [
  '#0d9488', // 青绿
  '#c2410c', // 陶土
  '#b45309', // 琥珀
  '#4d7c0f', // 橄榄
  '#0e7490', // 青蓝
  '#be123c', // 绛红
  '#15803d', // 草绿
  '#a16207', // 黄褐
  '#0f766e', // 深青绿
  '#ea580c', // 橙
  '#3f6212', // 深橄榄
  '#155e75', // 深青
  '#9f1239', // 深绛
  '#65a30d', // 黄绿
  '#854d0e' // 深褐
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
