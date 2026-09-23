import { sumAmounts, type Period, type RecordNode } from '@ledger/shared';

/**
 * 基于整棵记录树的纯计算：某个月有哪些条目、每月合计、分类配色、搜索、
 * 名称联想。页面只管展示，这些规则集中在这里。
 */

/** 分类色板有 8 个槽位；超出的分类统一落到 0 号「其他」灰 */
export const SLOT_COUNT = 8;

/** 顶级条目的金额：分组取子项汇总，独立条目取自身 */
export const amountOf = (n: RecordNode): number => n.subtotal ?? n.amount ?? 0;

const byAmountDesc = (a: RecordNode, b: RecordNode) => amountOf(b) - amountOf(a) || a.id - b.id;

/** 某个月的顶级条目，按金额从大到小；分组里的子项也按金额排 */
export function itemsOf(tree: RecordNode[], period: Period): RecordNode[] {
  return tree
    .filter((n) => n.period === period)
    .map((n) => (n.children.length > 1 ? { ...n, children: [...n.children].sort(byAmountDesc) } : n))
    .sort(byAmountDesc);
}

/** 每个月的合计 */
export function monthTotals(tree: RecordNode[]): Map<Period, number> {
  const lists = new Map<Period, number[]>();
  for (const n of tree) {
    const list = lists.get(n.period);
    if (list) list.push(amountOf(n));
    else lists.set(n.period, [amountOf(n)]);
  }
  const out = new Map<Period, number>();
  for (const [p, list] of lists) out.set(p, sumAmounts(list));
  return out;
}

/** 有金额的条目数：分组数它的子项，独立条目数它自己 */
export function entryCount(items: RecordNode[]): number {
  return items.reduce((s, n) => s + (n.children.length || 1), 0);
}

/**
 * 分类 → 色板槽位。
 *
 * 颜色跟着分类走，不跟着排名走：按「第一次出现」的顺序分配（先比月份，再比 id），
 * 以后怎么增删改都不会让已有分类换色。切月份、切统计区间时，
 * 「房租」永远是同一个颜色。
 */
export function categorySlots(tree: RecordNode[]): Map<string, number> {
  const first = new Map<string, RecordNode>();
  for (const n of tree) {
    const seen = first.get(n.name);
    if (!seen || n.period < seen.period || (n.period === seen.period && n.id < seen.id)) first.set(n.name, n);
  }
  const ordered = [...first.values()].sort((a, b) =>
    a.period === b.period ? a.id - b.id : a.period < b.period ? -1 : 1
  );
  const slots = new Map<string, number>();
  ordered.forEach((n, i) => slots.set(n.name, i < SLOT_COUNT ? i + 1 : 0));
  return slots;
}

/* ------------------------------------------------------------ 搜索 */

export interface SearchHit {
  /** 有金额的那一条：独立条目，或分组里的子项 */
  node: RecordNode;
  /** 子项所在的分组 */
  group?: RecordNode;
}

/**
 * 在全部月份里找名称 / 备注包含关键词的记录。
 *
 * 结果只包含有金额的条目，合计不会重复计算：搜到分组名时，
 * 返回的是它下面的全部子项，而不是分组本身。
 */
export function searchRecords(tree: RecordNode[], keyword: string): SearchHit[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return [];
  const hit = (n: RecordNode) => n.name.toLowerCase().includes(k) || (n.detail ?? '').toLowerCase().includes(k);

  const out: SearchHit[] = [];
  for (const top of tree) {
    if (top.children.length === 0) {
      if (hit(top)) out.push({ node: top });
      continue;
    }
    const whole = hit(top);
    for (const c of top.children) if (whole || hit(c)) out.push({ node: c, group: top });
  }
  const periodOf = (h: SearchHit) => (h.group ?? h.node).period;
  return out.sort((a, b) =>
    periodOf(a) === periodOf(b) ? amountOf(b.node) - amountOf(a.node) : periodOf(a) < periodOf(b) ? 1 : -1
  );
}

/* ------------------------------------------------------------ 名称联想 */

export interface NameMemory {
  name: string;
  /** 上次所在的分组名；独立条目没有 */
  group?: string;
  /** 最近一次的金额 */
  amount: number;
  period: Period;
  /** 一共记过几次，用来排序 */
  count: number;
}

/**
 * 记过的名称，按「记过的次数」再按「最近一次」排序。
 * 同名但在不同分组下的算两条 —— 选中时连同分组一起带出来。
 */
export function nameHistory(tree: RecordNode[]): NameMemory[] {
  const map = new Map<string, NameMemory>();
  const remember = (n: RecordNode, group?: RecordNode) => {
    const key = `${group?.name ?? ''}\u0000${n.name}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { name: n.name, group: group?.name, amount: n.amount ?? 0, period: n.period, count: 1 });
      return;
    }
    cur.count += 1;
    if (n.period >= cur.period) {
      cur.period = n.period;
      cur.amount = n.amount ?? 0;
    }
  };
  for (const top of tree) {
    if (top.children.length === 0) remember(top);
    else for (const c of top.children) remember(c, top);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.period < b.period ? 1 : -1));
}

/** 记过的分组名，按出现次数排序 */
export function groupHistory(tree: RecordNode[]): string[] {
  const counts = new Map<string, number>();
  for (const top of tree) if (top.children.length > 0) counts.set(top.name, (counts.get(top.name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
