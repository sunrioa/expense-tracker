import { describe, expect, test } from 'bun:test';
import type { RecordNode } from '@ledger/shared';
import {
  SLOT_COUNT,
  categorySlots,
  entryCount,
  groupHistory,
  itemsOf,
  monthTotals,
  nameHistory,
  searchRecords
} from './ledger';

let seq = 0;
function leaf(name: string, amount: number, period: string, detail?: string, id = ++seq): RecordNode {
  return {
    id,
    name,
    detail,
    amount,
    subtotal: amount,
    period,
    hasChildren: false,
    amountEditable: true,
    depth: 0,
    children: []
  };
}

function group(name: string, period: string, children: RecordNode[], id = ++seq): RecordNode {
  const kids = children.map((c) => ({ ...c, parentId: id, depth: 1 }));
  return {
    id,
    name,
    amount: 0,
    subtotal: kids.reduce((s, c) => s + (c.amount ?? 0), 0),
    period,
    hasChildren: kids.length > 0,
    amountEditable: kids.length === 0,
    depth: 0,
    children: kids
  };
}

const TREE: RecordNode[] = [
  group('交通', '2026-08', [leaf('单车', 80, '2026-08'), leaf('地铁', 300, '2026-08', '通勤')]),
  leaf('吃', 2000, '2026-08', '午餐'),
  group('交通', '2026-09', [leaf('地铁', 320.5, '2026-09', '通勤 + 周末'), leaf('单车', 80, '2026-09')]),
  leaf('房租', 3200, '2026-09'),
  leaf('吃', 2480.75, '2026-09', '工作日午餐')
];

describe('itemsOf', () => {
  test('只取这个月的顶级条目，按金额从大到小', () => {
    expect(itemsOf(TREE, '2026-09').map((n) => n.name)).toEqual(['房租', '吃', '交通']);
  });

  test('分组里的子项也按金额排', () => {
    const traffic = itemsOf(TREE, '2026-08').find((n) => n.name === '交通')!;
    expect(traffic.children.map((c) => c.name)).toEqual(['地铁', '单车']);
  });

  test('没有记录的月份是空数组', () => {
    expect(itemsOf(TREE, '2026-10')).toEqual([]);
  });
});

describe('monthTotals / entryCount', () => {
  test('按分算合计，没有浮点误差', () => {
    const totals = monthTotals(TREE);
    expect(totals.get('2026-09')).toBe(6081.25);
    expect(totals.get('2026-08')).toBe(2380);
    expect(totals.has('2026-10')).toBe(false);
  });

  test('分组数子项，独立条目数自己', () => {
    expect(entryCount(itemsOf(TREE, '2026-09'))).toBe(4);
  });
});

describe('categorySlots', () => {
  test('按第一次出现的顺序分配：先比月份，再比 id', () => {
    const slots = categorySlots(TREE);
    expect(slots.get('交通')).toBe(1);
    expect(slots.get('吃')).toBe(2);
    expect(slots.get('房租')).toBe(3);
  });

  test('金额怎么变，颜色都不变 —— 颜色跟着分类走，不跟着排名走', () => {
    const richer = TREE.map((n) => (n.name === '房租' ? { ...n, amount: 99999, subtotal: 99999 } : n));
    expect(categorySlots(richer)).toEqual(categorySlots(TREE));
  });

  test('超过色板槽位的分类落到 0 号「其他」', () => {
    const many = Array.from({ length: SLOT_COUNT + 2 }, (_, i) => leaf(`分类${i}`, 1, '2026-01'));
    const slots = categorySlots(many);
    expect(slots.get('分类0')).toBe(1);
    expect(slots.get(`分类${SLOT_COUNT - 1}`)).toBe(SLOT_COUNT);
    expect(slots.get(`分类${SLOT_COUNT}`)).toBe(0);
    expect(slots.get(`分类${SLOT_COUNT + 1}`)).toBe(0);
  });
});

describe('searchRecords', () => {
  test('空关键词不返回结果', () => {
    expect(searchRecords(TREE, '  ')).toEqual([]);
  });

  test('搜分组名，返回它下面的全部子项，不返回分组本身', () => {
    const hits = searchRecords(TREE, '交通');
    expect(hits.map((h) => `${h.group?.name}/${h.node.name}`)).toEqual([
      '交通/地铁',
      '交通/单车',
      '交通/地铁',
      '交通/单车'
    ]);
  });

  test('名称和备注都搜，不区分大小写；最近的月份在前', () => {
    const hits = searchRecords(TREE, '午餐');
    expect(hits.map((h) => [h.node.name, h.node.period])).toEqual([
      ['吃', '2026-09'],
      ['吃', '2026-08']
    ]);
    expect(searchRecords([leaf('Netflix', 45, '2026-09')], 'netflix')).toHaveLength(1);
  });

  test('只命中子项时带上所在分组', () => {
    const hits = searchRecords(TREE, '周末');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.group?.name).toBe('交通');
  });
});

describe('nameHistory / groupHistory', () => {
  test('记过的名称带出最近一次的金额和分组，按次数排序', () => {
    const history = nameHistory(TREE);
    const subway = history.find((m) => m.name === '地铁')!;
    expect(subway).toMatchObject({ group: '交通', amount: 320.5, period: '2026-09', count: 2 });
    expect(history.find((m) => m.name === '房租')).toMatchObject({ group: undefined, count: 1 });
    expect(history[history.length - 1]!.count).toBe(1);
  });

  test('同名但不在同一个分组，算两条', () => {
    const tree = [group('交通', '2026-09', [leaf('其他', 10, '2026-09')]), leaf('其他', 20, '2026-09')];
    expect(nameHistory(tree).filter((m) => m.name === '其他')).toHaveLength(2);
  });

  test('分组名按出现次数排序', () => {
    expect(groupHistory(TREE)).toEqual(['交通']);
  });
});
