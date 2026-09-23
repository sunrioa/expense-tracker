import { describe, expect, test } from 'bun:test';
import { copyCreatedCount, copyTotal, planCopyMonth } from './copy';
import type { ExpenseRow } from './types';

const row = (id: number, parentId: number | null, name: string, amount: number, period: string): ExpenseRow => ({
  id, parentId, name, detail: null, amount, period, sortOrder: 0
});

// 8 月：一个分组（交通 → 单车 / 地铁），两个独立条目
const AUGUST = [
  row(1, null, '交通', 0, '2026-08'),
  row(2, 1, '单车', 80, '2026-08'),
  row(3, 1, '地铁', 320.5, '2026-08'),
  row(4, null, '房租', 3200, '2026-08'),
  row(5, null, '话费', 99, '2026-08')
];

describe('planCopyMonth 参数校验', () => {
  test('源月份和目标月份相同', () => {
    expect(() => planCopyMonth(AUGUST, '2026-08', '2026-08')).toThrow('源月份和目标月份相同，不需要复制');
  });

  test('源月份没有记录', () => {
    expect(() => planCopyMonth(AUGUST, '2026-07', '2026-09')).toThrow('2026年07月没有可复制的记录');
  });

  test('缺月份', () => {
    expect(() => planCopyMonth(AUGUST, '', '2026-09')).toThrow('请选择要复制的月份和目标月份');
  });

  test('月份非法一路抛出去（由 HTTP 层映射成 400）', () => {
    expect(() => planCopyMonth(AUGUST, '2026-13', '2026-09')).toThrow('月份不合法');
  });

  test('宽松写法照样认', () => {
    expect(planCopyMonth(AUGUST, '2026年8月', '2026/9').to).toBe('2026-09');
  });
});

describe('planCopyMonth 复制到空月份', () => {
  const plan = planCopyMonth(AUGUST, '2026-08', '2026-09');

  test('顶级条目全部新建，分组本身记 0', () => {
    expect(plan.topsToCreate).toEqual([
      { sourceId: 1, name: '交通', detail: null, amount: 0 },
      { sourceId: 4, name: '房租', detail: null, amount: 3200 },
      { sourceId: 5, name: '话费', detail: null, amount: 99 }
    ]);
  });

  test('子项挂在新建分组的占位引用下', () => {
    expect(plan.children.map((c) => [c.parent, c.name, c.amount])).toEqual([
      [{ kind: 'new', sourceId: 1 }, '单车', 80],
      [{ kind: 'new', sourceId: 1 }, '地铁', 320.5]
    ]);
  });

  test('计数与金额合计', () => {
    expect(plan.skipped).toBe(0);
    expect(copyCreatedCount(plan)).toBe(5);
    expect(copyTotal(plan)).toBe(3699.5);
  });

  test('别的月份的记录不受影响', () => {
    const withJuly = [...AUGUST, row(9, null, '旅行', 5000, '2026-07')];
    expect(planCopyMonth(withJuly, '2026-08', '2026-09').topsToCreate.map((t) => t.name)).not.toContain('旅行');
  });
});

describe('planCopyMonth 目标月已有记录', () => {
  test('同名独立条目跳过，名称不区分大小写', () => {
    const rows = [...AUGUST, row(10, null, '话费', 129, '2026-09')];
    const plan = planCopyMonth(rows, '2026-08', '2026-09');
    expect(plan.topsToCreate.map((t) => t.name)).toEqual(['交通', '房租']);
    expect(plan.skipped).toBe(1);

    const upper = planCopyMonth(
      [row(1, null, 'Netflix', 45, '2026-08'), row(2, null, 'netflix', 45, '2026-09')],
      '2026-08',
      '2026-09'
    );
    expect(upper.skipped).toBe(1);
    expect(copyCreatedCount(upper)).toBe(0);
  });

  test('同名分组已存在：并进去，只补缺的子项', () => {
    const rows = [...AUGUST, row(10, null, '交通', 0, '2026-09'), row(11, 10, '单车', 95, '2026-09')];
    const plan = planCopyMonth(rows, '2026-08', '2026-09');
    expect(plan.topsToCreate.map((t) => t.name)).toEqual(['房租', '话费']);
    expect(plan.children).toEqual([{ parent: { kind: 'existing', id: 10 }, name: '地铁', detail: null, amount: 320.5 }]);
    expect(plan.skipped).toBe(1);
  });

  test('目标月的同名条目有金额且不是分组：整组跳过，不悄悄把它变成分组', () => {
    const rows = [...AUGUST, row(10, null, '交通', 600, '2026-09')];
    const plan = planCopyMonth(rows, '2026-08', '2026-09');
    expect(plan.children).toEqual([]);
    expect(plan.topsToCreate.map((t) => t.name)).toEqual(['房租', '话费']);
    expect(plan.skipped).toBe(2);
  });

  test('目标月的同名条目金额为 0：当作空分组，子项照常补进去', () => {
    const rows = [...AUGUST, row(10, null, '交通', 0, '2026-09')];
    const plan = planCopyMonth(rows, '2026-08', '2026-09');
    expect(plan.children.map((c) => c.parent)).toEqual([
      { kind: 'existing', id: 10 },
      { kind: 'existing', id: 10 }
    ]);
  });

  test('全部已存在时什么都不建', () => {
    const rows = [
      ...AUGUST,
      row(10, null, '交通', 0, '2026-09'),
      row(11, 10, '单车', 80, '2026-09'),
      row(12, 10, '地铁', 300, '2026-09'),
      row(13, null, '房租', 3200, '2026-09'),
      row(14, null, '话费', 99, '2026-09')
    ];
    const plan = planCopyMonth(rows, '2026-08', '2026-09');
    expect(copyCreatedCount(plan)).toBe(0);
    expect(plan.skipped).toBe(4);
  });
});
