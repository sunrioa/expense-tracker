import { describe, expect, test } from 'bun:test';
import {
  buildForest,
  buildLeaves,
  buildOptions,
  collectWithDescendants,
  depthOf,
  distinctPeriods,
  fullPath,
  indexById,
  isDescendant,
  topCategoryOf
} from './tree';
import type { ExpenseRow } from './types';

const row = (
  id: number,
  parentId: number | null,
  name: string,
  amount: number,
  period: string,
  detail: string | null = null
): ExpenseRow => ({ id, parentId, name, detail, amount, period, sortOrder: 0 });

/** 两个月、三个顶级条目、两层结构 */
const SAMPLE: ExpenseRow[] = [
  row(1, null, '交通', 0, '2026-09'),
  row(2, 1, '单车', 80, '2026-09', '月卡'),
  row(3, 1, '地铁', 320.5, '2026-09', '通勤'),
  row(4, null, '吃', 2480.75, '2026-09', '午餐'),
  row(5, null, '房租', 0, '2026-08'),
  row(6, 5, '主卧', 3200, '2026-08')
];

describe('buildForest', () => {
  test('顶级按月份升序、再按 id 升序', () => {
    const forest = buildForest(SAMPLE);
    expect(forest.map((n) => n.name)).toEqual(['房租', '交通', '吃']);
  });

  test('父项金额由子项汇总且不可编辑，叶子相反', () => {
    const traffic = buildForest(SAMPLE).find((n) => n.name === '交通')!;
    expect(traffic.subtotal).toBe(400.5);
    expect(traffic.hasChildren).toBe(true);
    expect(traffic.amountEditable).toBe(false);

    const eat = buildForest(SAMPLE).find((n) => n.name === '吃')!;
    expect(eat.subtotal).toBe(2480.75);
    expect(eat.amountEditable).toBe(true);
  });

  test('深度与路径', () => {
    const traffic = buildForest(SAMPLE).find((n) => n.name === '交通')!;
    expect(traffic.depth).toBe(0);
    expect(traffic.path).toBe('交通');
    const bike = traffic.children.find((c) => c.name === '单车')!;
    expect(bike.depth).toBe(1);
    expect(bike.path).toBe('交通 / 单车');
  });

  test('汇总走整数分，不出现浮点尾巴', () => {
    const rows = [row(1, null, '杂项', 0, '2026-09'), row(2, 1, 'a', 0.1, '2026-09'), row(3, 1, 'b', 0.2, '2026-09')];
    expect(buildForest(rows)[0]!.subtotal).toBe(0.3);
  });

  test('按月份过滤会整棵子树丢弃', () => {
    const forest = buildForest(SAMPLE, { from: '2026-09', to: '2026-09' });
    expect(forest.map((n) => n.name)).toEqual(['交通', '吃']);
  });

  test('自己不匹配但有匹配的子孙时，父项作为容器保留', () => {
    const forest = buildForest(SAMPLE, { keyword: '地铁' });
    expect(forest).toHaveLength(1);
    expect(forest[0]!.name).toBe('交通');
    expect(forest[0]!.children.map((c) => c.name)).toEqual(['地铁']);
    // 汇总只算存活下来的子项 —— 这是过滤态下的既有语义
    expect(forest[0]!.subtotal).toBe(320.5);
  });

  test('只有父项匹配时，它会变成一个没有子项的节点', () => {
    const forest = buildForest(SAMPLE, { keyword: '交通' });
    expect(forest).toHaveLength(1);
    expect(forest[0]!.hasChildren).toBe(false);
    expect(forest[0]!.subtotal).toBe(0);
    expect(forest[0]!.amountEditable).toBe(true);
  });

  test('关键词匹配详细说明，且大小写不敏感', () => {
    expect(buildForest(SAMPLE, { keyword: '月卡' })[0]!.children[0]!.name).toBe('单车');
    const rows = [row(1, null, 'Netflix', 45, '2026-09')];
    expect(buildForest(rows, { keyword: 'netflix' })).toHaveLength(1);
  });

  test('没有任何匹配时返回空森林', () => {
    expect(buildForest(SAMPLE, { keyword: '不存在的东西' })).toEqual([]);
  });
});

describe('buildLeaves', () => {
  test('只返回叶子，按月份倒序、id 倒序', () => {
    expect(buildLeaves(SAMPLE).map((n) => n.id)).toEqual([4, 3, 2, 6]);
  });
  test('叶子的 subtotal 等于自身金额', () => {
    expect(buildLeaves(SAMPLE).find((n) => n.id === 3)!.subtotal).toBe(320.5);
  });
});

describe('buildOptions', () => {
  test('不传月份时标签带上月份前缀，并按标签排序', () => {
    const opts = buildOptions(SAMPLE);
    expect(opts[0]!.label).toBe('[2026-08] 房租');
    expect(opts.map((o) => o.label)).toContain('[2026-09] 交通 / 单车');
  });
  test('传了月份只返回该月，标签不带前缀', () => {
    const opts = buildOptions(SAMPLE, '2026-08');
    expect(opts.map((o) => o.label)).toEqual(['房租', '房租 / 主卧']);
  });
  test('hasChildren 标记正确', () => {
    const opts = buildOptions(SAMPLE, '2026-09');
    expect(opts.find((o) => o.name === '交通')!.hasChildren).toBe(true);
    expect(opts.find((o) => o.name === '单车')!.hasChildren).toBe(false);
  });
});

describe('层级工具', () => {
  const byId = indexById(SAMPLE);

  test('fullPath / depthOf / topCategoryOf', () => {
    const metro = SAMPLE.find((r) => r.id === 3)!;
    expect(fullPath(metro, byId)).toBe('交通 / 地铁');
    expect(depthOf(metro, byId)).toBe(1);
    expect(topCategoryOf(metro, byId)).toBe('交通');
  });

  test('顶级条目的分类就是自己', () => {
    expect(topCategoryOf(SAMPLE.find((r) => r.id === 4)!, byId)).toBe('吃');
  });

  test('collectWithDescendants 含自身', () => {
    expect(collectWithDescendants(SAMPLE, 1).sort()).toEqual([1, 2, 3]);
    expect(collectWithDescendants(SAMPLE, 4)).toEqual([4]);
  });

  test('脏数据成环时不会死循环', () => {
    // 原 Java 版这里没有 seen 保护
    const cyclic = [row(10, 11, 'a', 0, '2026-09'), row(11, 10, 'b', 0, '2026-09')];
    expect(collectWithDescendants(cyclic, 10).sort()).toEqual([10, 11]);
  });

  test('isDescendant 用于成环检测', () => {
    expect(isDescendant(SAMPLE, 1, 2)).toBe(true);
    expect(isDescendant(SAMPLE, 2, 1)).toBe(false);
  });

  test('distinctPeriods 倒序且去空', () => {
    const withBlank = [...SAMPLE, row(9, null, '脏数据', 0, '')];
    expect(distinctPeriods(withBlank)).toEqual(['2026-09', '2026-08']);
  });
});
