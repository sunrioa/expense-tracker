import type { Period } from '../types/api';

/** 后端 BigDecimal 反序列化过来通常是 number，但留出字符串 / 缺失的余地 */
type Numeric = number | string | null | undefined;

/** 树形节点的最小形状，够 walkTree 递归就行 */
export interface TreeLike<T> {
  children?: T[] | null;
}

export const money = (v: Numeric): string => {
  const n = Number(v || 0);
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const yuan = (v: Numeric): string => `¥${money(v)}`;

/** 数值四舍五入到 2 位，避免浮点误差 */
export const round2 = (v: Numeric): number => Math.round((Number(v) || 0) * 100) / 100;

/** 2026-09 → 2026年09月 */
export const periodLabel = (p?: Period | null): string => {
  if (!p) return '全部月份';
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m ? `${m[1]}年${m[2]}月` : p;
};

/** 2026-09 → 09月（图表轴上更短） */
export const periodShort = (p?: Period | null): string => {
  if (!p) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m ? `${m[2]}月` : p;
};

/** 当前月份 yyyy-MM */
export const currentPeriod = (): Period => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** 遍历树，回调每个节点 */
export function walkTree<T extends TreeLike<T>>(
  nodes: T[] | null | undefined,
  fn: (node: T, parent: T | null) => void,
  parent: T | null = null
): void {
  (nodes ?? []).forEach((n) => {
    fn(n, parent);
    if (n.children && n.children.length) {
      walkTree(n.children, fn, n);
    }
  });
}

/** 收集所有「有子项」的节点 id */
export function groupIds<T extends TreeLike<T> & { id: number; hasChildren: boolean }>(
  nodes: T[] | null | undefined
): number[] {
  const ids: number[] = [];
  walkTree(nodes, (n) => {
    if (n.hasChildren) ids.push(n.id);
  });
  return ids;
}

/** 树的总金额 = 各顶级节点汇总之和 */
export function treeTotal(nodes: ReadonlyArray<{ subtotal?: Numeric }> | null | undefined): number {
  return round2((nodes ?? []).reduce((s, n) => s + Number(n.subtotal || 0), 0));
}

/** 树中叶子节点数量 */
export function leafCount<T extends TreeLike<T> & { hasChildren: boolean }>(
  nodes: T[] | null | undefined
): number {
  let c = 0;
  walkTree(nodes, (n) => {
    if (!n.hasChildren) c += 1;
  });
  return c;
}
