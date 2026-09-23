import { beforeEach, describe, expect, test } from 'bun:test';
import { currentPeriod } from '@ledger/shared';
import { createMemoryRepository } from '../db/memory';
import type { RecordRepository } from '../db/repository';
import type { ExpenseRow } from '../domain/types';
import { createExpenseService } from './expense.service';

const row = (id: number, parentId: number | null, name: string, amount: number, period: string): ExpenseRow => ({
  id, parentId, name, detail: null, amount, period, sortOrder: 0
});

let repo: RecordRepository;
let service: ReturnType<typeof createExpenseService>;

beforeEach(() => {
  repo = createMemoryRepository([
    row(1, null, '交通', 0, '2026-09'),
    row(2, 1, '单车', 80, '2026-09'),
    row(3, 1, '地铁', 320.5, '2026-09'),
    row(4, null, '吃', 2480.75, '2026-09')
  ]);
  service = createExpenseService(repo);
});

describe('create', () => {
  test('新建顶级条目', async () => {
    const node = await service.create({ name: '话费', amount: 99, period: '2026-09' });
    expect(node.name).toBe('话费');
    expect(node.parentId).toBeUndefined();
    expect(node.depth).toBe(0);
  });

  test('不传月份时落到当月', async () => {
    const node = await service.create({ name: '话费', amount: 99 });
    expect(node.period).toBe(currentPeriod());
  });

  test('子项不传月份时跟随父项，避免父子跨月', async () => {
    const node = await service.create({ parentId: 1, name: '打车', amount: 60 });
    expect(node.period).toBe('2026-09');
    expect(node.path).toBe('交通 / 打车');
    expect(node.depth).toBe(1);
  });

  test('只允许两级：子项下不能再挂子项', async () => {
    await expect(service.create({ parentId: 2, name: '再一层', amount: 1 })).rejects.toThrow(
      '「单车」已经是子项，子项下不能再添加子项；请把新条目加到顶级条目下'
    );
  });

  test('父项不存在', async () => {
    await expect(service.create({ parentId: 999, name: 'x', amount: 1 })).rejects.toThrow('父项不存在，无法添加子项');
  });
});

describe('update 局部更新', () => {
  test('只提交一个字段时其它字段保持不变', async () => {
    await service.update(2, { name: '共享单车' });
    const all = await repo.findAll();
    const bike = all.find((r) => r.id === 2)!;
    expect(bike.name).toBe('共享单车');
    expect(bike.amount).toBe(80);
    expect(bike.period).toBe('2026-09');
  });

  test('detail 传空串表示清空', async () => {
    await service.update(2, { detail: '月卡' });
    expect((await repo.findAll()).find((r) => r.id === 2)!.detail).toBe('月卡');
    await service.update(2, { detail: '' });
    expect((await repo.findAll()).find((r) => r.id === 2)!.detail).toBeNull();
  });

  test('amount 传 null 归零', async () => {
    await service.update(2, { amount: null });
    expect((await repo.findAll()).find((r) => r.id === 2)!.amount).toBe(0);
  });

  test('amount 接受字符串', async () => {
    await service.update(2, { amount: '123.456' });
    expect((await repo.findAll()).find((r) => r.id === 2)!.amount).toBe(123.46);
  });

  test('各种非法输入的报错文案', async () => {
    await expect(service.update(2, { amount: -1 })).rejects.toThrow('支出金额不能为负数');
    await expect(service.update(2, { amount: '不是数字' })).rejects.toThrow('支出金额格式不正确：不是数字');
    await expect(service.update(2, { name: '   ' })).rejects.toThrow('支出名称不能为空');
    await expect(service.update(2, { name: 'x'.repeat(65) })).rejects.toThrow('支出名称最长 64 个字符');
    await expect(service.update(999, { name: 'x' })).rejects.toThrow('记录不存在：999');
  });

  test('改父项月份会把子孙一起带过去', async () => {
    await service.update(1, { period: '2026-10' });
    const all = await repo.findAll();
    expect(all.find((r) => r.id === 1)!.period).toBe('2026-10');
    expect(all.find((r) => r.id === 2)!.period).toBe('2026-10');
    expect(all.find((r) => r.id === 3)!.period).toBe('2026-10');
    // 不相干的条目不受影响
    expect(all.find((r) => r.id === 4)!.period).toBe('2026-09');
  });

  test('月份没变时不触发级联', async () => {
    await service.update(1, { period: '2026-09' });
    expect((await repo.findAll()).find((r) => r.id === 2)!.period).toBe('2026-09');
  });

  test('改父项时的成环与层级保护', async () => {
    await expect(service.update(1, { parentId: 1 })).rejects.toThrow('不能把自己设为自己的父项');
    await expect(service.update(1, { parentId: 2 })).rejects.toThrow('不能把子项设为自己的父项（会形成环）');
    await expect(service.update(4, { parentId: 2 })).rejects.toThrow(
      '「单车」已经是子项，子项下不能再添加子项；请挂到顶级条目下'
    );
    await expect(service.update(4, { parentId: 999 })).rejects.toThrow('父项不存在：999');
    await expect(service.update(4, { parentId: '乱码' })).rejects.toThrow('非法的 ID：乱码');
  });

  test('parentId 传 null 变回顶级条目', async () => {
    await service.update(2, { parentId: null });
    expect((await repo.findAll()).find((r) => r.id === 2)!.parentId).toBeNull();
  });
});

describe('delete', () => {
  test('级联删除子孙', async () => {
    const res = await service.remove(1);
    expect(res.deleted).toBe(3);
    expect((await repo.findAll()).map((r) => r.id)).toEqual([4]);
  });

  test('删叶子只删一条', async () => {
    expect((await service.remove(2)).deleted).toBe(1);
  });

  test('删不存在的记录报错', async () => {
    await expect(service.remove(999)).rejects.toThrow('记录不存在：999');
  });
});

describe('batchFill 落库', () => {
  test('按月生成父项与子项，并回填真实父项 id', async () => {
    const res = await service.batchFill({
      parentName: '房租',
      createParentIfMissing: true,
      items: [{ name: '主卧', amount: 3200 }, { name: '水电', amount: 268.4 }],
      fromPeriod: '2026-01',
      toPeriod: '2026-03',
      detailTemplate: '{parent} {month} 月',
      skipExisting: true
    });

    expect(res.months).toBe(3);
    expect(res.parentCreated).toBe(3);
    expect(res.created).toBe(6);
    expect(res.skipped).toBe(0);
    expect(res.totalAmount).toBe(10405.2);

    const all = await repo.findAll();
    const jan = all.filter((r) => r.period === '2026-01');
    const parent = jan.find((r) => r.name === '房租')!;
    const children = jan.filter((r) => r.parentId === parent.id);
    expect(children.map((c) => c.name).sort()).toEqual(['主卧', '水电']);
    expect(children[0]!.detail).toBe('房租 01 月');
  });

  test('重复执行会全部跳过，可以放心重复点', async () => {
    const args = {
      parentName: '房租',
      createParentIfMissing: true,
      items: [{ name: '主卧', amount: 3200 }],
      fromPeriod: '2026-01',
      toPeriod: '2026-02',
      detailTemplate: null,
      skipExisting: true
    };
    await service.batchFill(args);
    const second = await service.batchFill(args);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    // 父项已存在，不会重复创建
    expect(second.parentCreated).toBe(0);
  });
});

describe('copyMonth 落库', () => {
  test('分组连同子项复制到新月份，子项挂到新建的分组下', async () => {
    const res = await service.copyMonth({ from: '2026-09', to: '2026-10' });
    expect(res).toEqual({ created: 4, skipped: 0, totalAmount: 2881.25 });

    const october = await service.tree({ from: '2026-10', to: '2026-10' });
    expect(october.map((n) => [n.name, n.subtotal])).toEqual([
      ['交通', 400.5],
      ['吃', 2480.75]
    ]);
    const traffic = october.find((n) => n.name === '交通')!;
    expect(traffic.id).not.toBe(1);
    expect(traffic.children.map((c) => c.name)).toEqual(['单车', '地铁']);
    // 源月份原封不动
    expect((await service.tree({ from: '2026-09', to: '2026-09' })).length).toBe(2);
  });

  test('重复执行全部跳过', async () => {
    await service.copyMonth({ from: '2026-09', to: '2026-10' });
    const second = await service.copyMonth({ from: '2026-09', to: '2026-10' });
    expect(second).toEqual({ created: 0, skipped: 3, totalAmount: 0 });
  });
});

describe('查询', () => {
  test('tree / leaves / options / periods', async () => {
    expect((await service.tree({})).map((n) => n.name)).toEqual(['交通', '吃']);
    expect((await service.leaves({})).map((n) => n.name)).toEqual(['吃', '地铁', '单车']);
    expect((await service.options('2026-09')).map((o) => o.label)).toContain('交通 / 地铁');
    expect(await service.periods()).toEqual(['2026-09']);
  });
});
