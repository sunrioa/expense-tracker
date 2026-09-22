import { inPeriodRange, sumAmounts, type Period } from '@ledger/shared';
import type { RecordNode, RecordOption } from '@ledger/shared';
import type { ExpenseRow, RecordFilter } from './types';

/** 路径 / 深度向上回溯的步数上限，防脏数据成环把循环跑飞 */
const WALK_GUARD = 50;

export function indexById(rows: ExpenseRow[]): Map<number, ExpenseRow> {
  const m = new Map<number, ExpenseRow>();
  // 与 Java 的 toMap(..., (a, b) -> a) 一致：重复 id 保留先出现的
  for (const r of rows) if (!m.has(r.id)) m.set(r.id, r);
  return m;
}

/** 所有「被别人当作父项」的 id —— 即非叶子节点 */
export function parentIdSet(rows: ExpenseRow[]): Set<number> {
  const s = new Set<number>();
  for (const r of rows) if (r.parentId !== null) s.add(r.parentId);
  return s;
}

/**
 * yyyy-MM 的字典序等价于时间序，直接比字符串。
 * null 排在最前，与 Java 版 comparePeriod 的行为一致。
 */
function comparePeriod(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 先按月份升序，再按 id 升序 */
function byPeriodThenId(a: RecordNode, b: RecordNode): number {
  const c = comparePeriod(a.period, b.period);
  return c !== 0 ? c : a.id - b.id;
}

export function matches(row: ExpenseRow, filter: RecordFilter): boolean {
  const { from, to, keyword } = filter;
  if ((from || to) && !inPeriodRange(row.period, from, to)) return false;
  if (keyword && keyword.trim() !== '') {
    const k = keyword.trim().toLowerCase();
    const name = (row.name ?? '').toLowerCase();
    const detail = (row.detail ?? '').toLowerCase();
    return name.includes(k) || detail.includes(k);
  }
  return true;
}

/** 完整路径，如「交通 / 地铁」 */
export function fullPath(row: ExpenseRow, byId: Map<number, ExpenseRow>): string {
  const parts: string[] = [];
  let cur: ExpenseRow | undefined = row;
  for (let guard = 0; cur && guard < WALK_GUARD; guard++) {
    parts.unshift(cur.name);
    cur = cur.parentId === null ? undefined : byId.get(cur.parentId);
  }
  return parts.join(' / ');
}

/** 距离顶级条目的层数，顶级为 0 */
export function depthOf(row: ExpenseRow, byId: Map<number, ExpenseRow>): number {
  let d = 0;
  let cur: ExpenseRow | undefined = row;
  for (let guard = 0; cur && cur.parentId !== null && guard < WALK_GUARD; guard++) {
    cur = byId.get(cur.parentId);
    d++;
  }
  return d;
}

/** 顶级祖先的名称，用作统计里的「分类」 */
export function topCategoryOf(row: ExpenseRow, byId: Map<number, ExpenseRow>): string {
  let cur: ExpenseRow | undefined = row;
  for (let guard = 0; cur && cur.parentId !== null && guard < WALK_GUARD; guard++) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur?.name ?? '未分类';
}

/** 自身 + 全部子孙的 id（用于级联删除和成环检测） */
export function collectWithDescendants(rows: ExpenseRow[], rootId: number): number[] {
  const childMap = new Map<number, number[]>();
  for (const r of rows) {
    if (r.parentId === null) continue;
    const list = childMap.get(r.parentId);
    if (list) list.push(r.id);
    else childMap.set(r.parentId, [r.id]);
  }
  const out: number[] = [];
  const stack = [rootId];
  const seen = new Set<number>();
  while (stack.length) {
    const cur = stack.pop()!;
    // 原 Java 版没有 seen 保护，脏数据成环会无限循环；这里补上
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    for (const child of childMap.get(cur) ?? []) stack.push(child);
  }
  return out;
}

/** candidateId 是否是 ancestorId 的子孙（含自身） */
export function isDescendant(rows: ExpenseRow[], ancestorId: number, candidateId: number): boolean {
  return collectWithDescendants(rows, ancestorId).includes(candidateId);
}

/**
 * 单个节点（不含子项），用于 leaves 列表和写入后的回包。
 * 金额规则：叶子的 subtotal 就是自身金额。
 */
export function toLeafNode(row: ExpenseRow, byId: Map<number, ExpenseRow>): RecordNode {
  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    name: row.name,
    detail: row.detail ?? undefined,
    amount: row.amount,
    subtotal: row.amount,
    period: row.period,
    sortOrder: row.sortOrder ?? undefined,
    hasChildren: false,
    amountEditable: true,
    depth: depthOf(row, byId),
    path: fullPath(row, byId),
    children: []
  };
}

/**
 * 构建树。
 *
 * 过滤语义：某个节点自己不匹配、但有匹配的子孙时，它仍然保留（作为容器展示）；
 * 自己不匹配且没有任何匹配的子孙时，整棵子树丢弃。
 *
 * 金额语义：只有叶子落库真实金额，父项的 subtotal 由子项汇总，
 * 避免统计时父子重复累加。
 */
export function buildForest(rows: ExpenseRow[], filter: RecordFilter = {}): RecordNode[] {
  const childMap = new Map<number | null, ExpenseRow[]>();
  for (const r of rows) {
    const key = r.parentId;
    const list = childMap.get(key);
    if (list) list.push(r);
    else childMap.set(key, [r]);
  }

  const roots: RecordNode[] = [];
  for (const r of childMap.get(null) ?? []) {
    const node = buildNode(r, childMap, filter, 0, undefined);
    if (node) roots.push(node);
  }
  roots.sort(byPeriodThenId);
  return roots;
}

function buildNode(
  row: ExpenseRow,
  childMap: Map<number | null, ExpenseRow[]>,
  filter: RecordFilter,
  depth: number,
  parentPath: string | undefined
): RecordNode | null {
  const path = parentPath === undefined ? row.name : `${parentPath} / ${row.name}`;

  const children: RecordNode[] = [];
  for (const c of childMap.get(row.id) ?? []) {
    const child = buildNode(c, childMap, filter, depth + 1, path);
    if (child) children.push(child);
  }

  // 自己不符合条件、也没有符合条件的孩子 → 整棵子树不展示
  if (children.length === 0 && !matches(row, filter)) return null;

  children.sort(byPeriodThenId);

  const hasChildren = children.length > 0;
  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    name: row.name,
    detail: row.detail ?? undefined,
    amount: row.amount,
    subtotal: hasChildren ? sumAmounts(children.map((c) => c.subtotal ?? 0)) : row.amount,
    period: row.period,
    sortOrder: row.sortOrder ?? undefined,
    hasChildren,
    // 有子项 → 金额由子项自动汇总，不可手工编辑
    amountEditable: !hasChildren,
    depth,
    path,
    children
  };
}

/** 扁平明细：只返回叶子节点，按月份倒序、id 倒序 */
export function buildLeaves(rows: ExpenseRow[], filter: RecordFilter = {}): RecordNode[] {
  const byId = indexById(rows);
  const parents = parentIdSet(rows);
  const out = rows
    .filter((r) => !parents.has(r.id) && matches(r, filter))
    .map((r) => toLeafNode(r, byId));
  out.sort((a, b) => {
    const c = comparePeriod(a.period, b.period);
    return c !== 0 ? -c : b.id - a.id;
  });
  return out;
}

/** 父项下拉选项。period 为空时标签前面带上月份。 */
export function buildOptions(rows: ExpenseRow[], period?: string): RecordOption[] {
  const byId = indexById(rows);
  const parents = parentIdSet(rows);
  const out: RecordOption[] = [];
  for (const r of rows) {
    if (period !== undefined && r.period !== period) continue;
    const path = fullPath(r, byId);
    out.push({
      id: r.id,
      label: period === undefined ? `[${r.period}] ${path}` : path,
      name: r.name,
      period: r.period,
      depth: depthOf(r, byId),
      hasChildren: parents.has(r.id)
    });
  }
  // 按标签排序。刻意用码位比较而不是 localeCompare，与原 Java 的 String.compareTo 一致
  out.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return out;
}

/** 已有的月份列表，倒序（最新在前） */
export function distinctPeriods(rows: ExpenseRow[]): Period[] {
  const set = new Set<string>();
  for (const r of rows) if (r.period && r.period.trim() !== '') set.add(r.period);
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
