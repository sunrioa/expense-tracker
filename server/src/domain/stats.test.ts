import { describe, expect, test } from 'bun:test';
import { PALETTE, computeStats } from './stats';
import type { ExpenseRow } from './types';

const row = (id: number, parentId: number | null, name: string, amount: number, period: string): ExpenseRow => ({
  id, parentId, name, detail: null, amount, period, sortOrder: 0
});

/** 交通(父,带脏金额) / 单车  +  吃，跨两个月 */
const SAMPLE: ExpenseRow[] = [
  row(1, null, '交通', 999, '2026-08'), // 父项，金额应被忽略
  row(2, 1, '单车', 80, '2026-08'),
  row(3, null, '吃', 200, '2026-08'),
  row(4, null, '交通', 999, '2026-09'), // 父项
  row(5, 4, '单车', 100, '2026-09'),
  row(6, null, '吃', 300, '2026-09')
];

describe('computeStats', () => {
  test('父项不参与累加，避免父子重复计算', () => {
    const s = computeStats(SAMPLE);
    expect(s.total).toBe(680); // 80+200+100+300，两个 999 的父项被排除
    expect(s.recordCount).toBe(4);
  });

  test('月份数与月均', () => {
    const s = computeStats(SAMPLE);
    expect(s.monthCount).toBe(2);
    expect(s.avgPerMonth).toBe(340);
  });

  test('最大单笔带上名称和月份', () => {
    const s = computeStats(SAMPLE);
    expect(s.maxAmount).toBe(300);
    expect(s.maxAmountName).toBe('吃');
    expect(s.maxAmountPeriod).toBe('2026-09');
  });

  test('金额并列时取先出现的那条', () => {
    const tied = [row(1, null, '甲', 50, '2026-09'), row(2, null, '乙', 50, '2026-09')];
    expect(computeStats(tied).maxAmountName).toBe('甲');
  });

  test('未指定区间时用数据自身范围回填', () => {
    const s = computeStats(SAMPLE);
    expect(s.fromPeriod).toBe('2026-08');
    expect(s.toPeriod).toBe('2026-09');
  });

  test('按名称聚合并按金额倒序配色', () => {
    const s = computeStats(SAMPLE);
    expect(s.byName.map((n) => [n.name, n.total, n.count])).toEqual([
      ['吃', 500, 2],
      ['单车', 180, 2]
    ]);
    expect(s.byName[0]!.color).toBe(PALETTE[0]);
    expect(s.byName[1]!.color).toBe(PALETTE[1]);
  });

  test('按分类聚合会上溯到顶级祖先', () => {
    const s = computeStats(SAMPLE);
    expect(s.byCategory.map((c) => [c.name, c.total])).toEqual([
      ['吃', 500],
      ['交通', 180]
    ]);
  });

  test('百分比合计约等于 100', () => {
    const s = computeStats(SAMPLE);
    const sum = s.byName.reduce((a, b) => a + b.percent, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);
  });

  test('按月分桶', () => {
    const s = computeStats(SAMPLE);
    expect(s.byPeriod.map((p) => [p.key, p.total, p.count])).toEqual([
      ['2026-08', 280, 2],
      ['2026-09', 400, 2]
    ]);
    expect(s.byPeriod[0]!.label).toBe('2026年08月');
  });

  test('区间内没有数据的月份也会铺出来，保证图表连续', () => {
    const s = computeStats(SAMPLE, { from: '2026-07', to: '2026-09' });
    expect(s.byPeriod.map((p) => p.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(s.byPeriod[0]!.total).toBe(0);
  });

  test('按年统计', () => {
    const s = computeStats(SAMPLE, { granularity: 'year' });
    expect(s.granularity).toBe('year');
    expect(s.byPeriod).toEqual([
      { key: '2026', label: '2026年', total: 680, count: 4, percent: 100 }
    ]);
  });

  test('granularity 传了乱七八糟的值按月处理，不报错', () => {
    expect(computeStats(SAMPLE, { granularity: 'day' }).granularity).toBe('month');
  });

  test('区间过滤', () => {
    const s = computeStats(SAMPLE, { from: '2026-09', to: '2026-09' });
    expect(s.total).toBe(400);
    expect(s.recordCount).toBe(2);
  });

  test('没有数据时全部归零且不抛错', () => {
    const s = computeStats([], { from: '2026-01', to: '2026-03' });
    expect(s.total).toBe(0);
    expect(s.recordCount).toBe(0);
    expect(s.byName).toEqual([]);
    expect(s.byPeriod).toEqual([]);
  });

  test('配色够 15 个且互不重复', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    expect(PALETTE.length).toBeGreaterThanOrEqual(15);
  });
});
