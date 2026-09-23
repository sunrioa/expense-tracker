import { roundAmount, sumAmounts, type Period } from '@ledger/shared';

/**
 * 前端展示用的格式化。
 *
 * 金额运算和月份规则统一从 @ledger/shared 取 —— 和后端用的是同一份实现，
 * 不会出现「前端算出来 6839.65、后端算出来 6839.649999」这种事。
 */

type Numeric = number | string | null | undefined;

/** 树形节点的最小形状，够 walkTree 递归就行 */
export interface TreeLike<T> {
  children?: T[] | null;
}

// 当月：和后端 normalizePeriod / currentPeriod 共用同一套定义
export { currentPeriod } from '@ledger/shared';
// 精确到分的求和 / 四舍五入，前端也用同一份
export { roundAmount, sumAmounts };

export const money = (v: Numeric): string => {
  const n = Number(v || 0);
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const yuan = (v: Numeric): string => `¥${money(v)}`;

/**
 * 2026-09 → 2026年09月。
 *
 * 和共享层的 periodLabelCN 差一个语义：这里 null 表示「没有筛选月份」，
 * 所以给的是「全部月份」而不是「未知月份」。
 */
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
  return sumAmounts((nodes ?? []).map((n) => n.subtotal ?? 0));
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
