import { describe, expect, test } from 'bun:test';
import type { BatchFillRequest } from '@ledger/shared';
import { BATCH_LIMIT, BATCH_MONTH_LIMIT, planBatchFill, plannedTotal, renderDetail } from './batch';
import { BusinessError } from './errors';
import type { ExpenseRow } from './types';

const row = (id: number, parentId: number | null, name: string, amount: number, period: string): ExpenseRow => ({
  id, parentId, name, detail: null, amount, period, sortOrder: 0
});

const req = (o: Partial<BatchFillRequest> = {}): BatchFillRequest => ({
  parentName: null,
  createParentIfMissing: true,
  items: [],
  fromPeriod: null,
  toPeriod: null,
  detailTemplate: null,
  skipExisting: true,
  ...o
});

describe('planBatchFill 参数校验', () => {
  test('缺月份', () => {
    expect(() => planBatchFill([], req({ items: [{ name: 'a', amount: 1 }] }))).toThrow('请选择起始月份和结束月份');
  });

  test('结束早于起始', () => {
    expect(() =>
      planBatchFill([], req({ items: [{ name: 'a', amount: 1 }], fromPeriod: '2026-05', toPeriod: '2026-01' }))
    ).toThrow('结束月份不能早于起始月份');
  });

  test('没有子项', () => {
    expect(() => planBatchFill([], req({ fromPeriod: '2026-01', toPeriod: '2026-01' }))).toThrow('请至少填写一个子项');
  });

  test(`月份区间超过 ${BATCH_MONTH_LIMIT} 个月`, () => {
    expect(() =>
      planBatchFill([], req({ items: [{ name: 'a', amount: 1 }], fromPeriod: '2026-01', toPeriod: '2036-01' }))
    ).toThrow(`月份区间过长（超过 ${BATCH_MONTH_LIMIT} 个月），请缩小范围`);
  });

  test(`总行数超过 ${BATCH_LIMIT}`, () => {
    const items = Array.from({ length: 42 }, (_, i) => ({ name: `item${i}`, amount: 1 }));
    expect(() =>
      planBatchFill([], req({ items, fromPeriod: '2026-01', toPeriod: '2035-12' }))
    ).toThrow(`本次将生成 5040 行，超过 ${BATCH_LIMIT} 行上限，请缩小月份范围或减少子项`);
  });

  test('月份格式非法会一路抛出去', () => {
    expect(() =>
      planBatchFill([], req({ items: [{ name: 'a', amount: 1 }], fromPeriod: '2026-13', toPeriod: '2026-13' }))
    ).toThrow('月份不合法');
  });
});

describe('planBatchFill 生成计划', () => {
  test('每个月各建一个父项，子项挂在当月的父项下', () => {
    const plan = planBatchFill(
      [],
      req({ parentName: '房租', items: [{ name: '主卧', amount: 3200 }], fromPeriod: '2026-01', toPeriod: '2026-03' })
    );
    expect(plan.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(plan.parentsToCreate.map((p) => p.period)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(plan.items).toHaveLength(3);
    expect(plan.items[0]!.parent).toEqual({ kind: 'new', period: '2026-01' });
    expect(plannedTotal(plan)).toBe(9600);
  });

  test('复用当月已存在的同名父项（大小写不敏感）', () => {
    const rows = [row(7, null, '房租', 0, '2026-01')];
    const plan = planBatchFill(
      rows,
      req({ parentName: '房 租'.replace(' ', ''), items: [{ name: '主卧', amount: 3200 }], fromPeriod: '2026-01', toPeriod: '2026-01' })
    );
    expect(plan.parentsToCreate).toEqual([]);
    expect(plan.items[0]!.parent).toEqual({ kind: 'existing', id: 7 });
  });

  test('createParentIfMissing=false 且父项不存在时报错', () => {
    expect(() =>
      planBatchFill(
        [],
        req({
          parentName: '房租',
          createParentIfMissing: false,
          items: [{ name: '主卧', amount: 3200 }],
          fromPeriod: '2026-01',
          toPeriod: '2026-01'
        })
      )
    ).toThrow(new BusinessError('月份 2026-01 下不存在父项「房租」'));
  });

  test('不传父项名时生成顶级条目', () => {
    const plan = planBatchFill([], req({ items: [{ name: '话费', amount: 99 }], fromPeriod: '2026-01', toPeriod: '2026-02' }));
    expect(plan.parentsToCreate).toEqual([]);
    expect(plan.items.every((i) => i.parent.kind === 'none')).toBe(true);
  });

  test('跳过已存在的同名同月记录', () => {
    const rows = [row(1, null, '话费', 99, '2026-01')];
    const plan = planBatchFill(
      rows,
      req({ items: [{ name: '话费', amount: 99 }], fromPeriod: '2026-01', toPeriod: '2026-03' })
    );
    expect(plan.skipped).toBe(1);
    expect(plan.items.map((i) => i.period)).toEqual(['2026-02', '2026-03']);
  });

  test('skipExisting=false 时照样重复生成', () => {
    const rows = [row(1, null, '话费', 99, '2026-01')];
    const plan = planBatchFill(
      rows,
      req({ items: [{ name: '话费', amount: 99 }], fromPeriod: '2026-01', toPeriod: '2026-01', skipExisting: false })
    );
    expect(plan.skipped).toBe(0);
    expect(plan.items).toHaveLength(1);
  });

  test('同一批里重名的子项也会被判重', () => {
    const plan = planBatchFill(
      [],
      req({ items: [{ name: '话费', amount: 99 }, { name: '话费', amount: 50 }], fromPeriod: '2026-01', toPeriod: '2026-01' })
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.skipped).toBe(1);
  });

  test('名称为空的子项直接忽略，但仍计入行数上限', () => {
    const plan = planBatchFill(
      [],
      req({ items: [{ name: '  ', amount: 1 }, { name: '话费', amount: 99 }], fromPeriod: '2026-01', toPeriod: '2026-01' })
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.name).toBe('话费');
  });

  test('金额缺省按 0 处理', () => {
    const plan = planBatchFill([], req({ items: [{ name: '话费' }], fromPeriod: '2026-01', toPeriod: '2026-01' }));
    expect(plan.items[0]!.amount).toBe(0);
  });
});

describe('renderDetail 模板', () => {
  test('四个占位符', () => {
    expect(renderDetail('{parent}/{name} {period} 第{month}月', null, '2026-09', '主卧', '房租')).toBe(
      '房租/主卧 2026-09 第09月'
    );
  });
  test('没有模板时退回子项自带的详细', () => {
    expect(renderDetail(null, '  自带说明  ', '2026-09', '主卧', '房租')).toBe('自带说明');
    expect(renderDetail('   ', null, '2026-09', '主卧', '房租')).toBeNull();
  });
  test('没有父项时 {parent} 渲染为空', () => {
    expect(renderDetail('{parent}-{name}', null, '2026-09', '话费', undefined)).toBe('-话费');
  });
  test('超过 255 字符会被截断', () => {
    expect(renderDetail('x'.repeat(300), null, '2026-09', 'a', undefined)!).toHaveLength(255);
  });
});
