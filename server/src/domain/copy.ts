import { normalizePeriod, periodLabelCN, sumAmounts } from '@ledger/shared';
import { BusinessError } from './errors';
import type { ExpenseRow } from './types';

/**
 * 新子项挂在哪个父项下：目标月已有的同名顶级条目，
 * 或者本次新建的顶级条目（还没有 id，用源行 id 占位）。
 */
export type CopyParentRef = { kind: 'existing'; id: number } | { kind: 'new'; sourceId: number };

export interface CopyPlan {
  from: string;
  to: string;
  /** 要新建的顶级条目 */
  topsToCreate: { sourceId: number; name: string; detail: string | null; amount: number }[];
  /** 要新建的子项 */
  children: { parent: CopyParentRef; name: string; detail: string | null; amount: number }[];
  skipped: number;
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * 把 from 月的记录整体复制到 to 月 —— 房租、话费这类每月都有的支出，
 * 下个月点一下就能沿用，再逐项改金额。
 *
 * 纯函数，不碰数据库。判重规则与批量生成一致（同一父项下同名视为同一条，
 * 大小写不敏感），所以重复点也不会生成两份：
 * - 独立条目：目标月已有同名顶级条目就跳过
 * - 分组：目标月已有同名分组就并进去，只补它还没有的子项
 * - 目标月的同名条目是**有金额的独立条目**、源月却是分组时，整组跳过 ——
 *   往独立条目下挂子项会把它变成分组，它原来的金额就不再计入合计，这种改动不能悄悄发生
 */
export function planCopyMonth(rows: ExpenseRow[], rawFrom: string, rawTo: string): CopyPlan {
  const from = normalizePeriod(rawFrom);
  const to = normalizePeriod(rawTo);
  if (!from || !to) throw new BusinessError('请选择要复制的月份和目标月份');
  if (from === to) throw new BusinessError('源月份和目标月份相同，不需要复制');

  const childrenOf = new Map<number, ExpenseRow[]>();
  for (const r of rows) {
    if (r.parentId === null) continue;
    const list = childrenOf.get(r.parentId);
    if (list) list.push(r);
    else childrenOf.set(r.parentId, [r]);
  }

  const sources = rows.filter((r) => r.parentId === null && r.period === from);
  if (sources.length === 0) throw new BusinessError(`${periodLabelCN(from)}没有可复制的记录`);

  // 目标月现有的顶级条目。同名的有多条时取第一条，和批量生成找父项的方式一致
  const targets = new Map<string, ExpenseRow>();
  for (const r of rows) {
    if (r.parentId === null && r.period === to && !targets.has(key(r.name))) targets.set(key(r.name), r);
  }

  const plan: CopyPlan = { from, to, topsToCreate: [], children: [], skipped: 0 };

  for (const src of sources) {
    const kids = childrenOf.get(src.id) ?? [];
    const existing = targets.get(key(src.name));

    if (kids.length === 0) {
      if (existing) plan.skipped += 1;
      else plan.topsToCreate.push({ sourceId: src.id, name: src.name, detail: src.detail, amount: src.amount });
      continue;
    }

    if (!existing) {
      // 分组自身的金额不参与合计（由子项汇总），复制过去记 0，不带隐藏数据
      plan.topsToCreate.push({ sourceId: src.id, name: src.name, detail: src.detail, amount: 0 });
      for (const k of kids) {
        plan.children.push({ parent: { kind: 'new', sourceId: src.id }, name: k.name, detail: k.detail, amount: k.amount });
      }
      continue;
    }

    const existingKids = childrenOf.get(existing.id) ?? [];
    if (existingKids.length === 0 && existing.amount > 0) {
      plan.skipped += kids.length;
      continue;
    }

    const have = new Set(existingKids.map((k) => key(k.name)));
    for (const k of kids) {
      if (have.has(key(k.name))) {
        plan.skipped += 1;
        continue;
      }
      plan.children.push({ parent: { kind: 'existing', id: existing.id }, name: k.name, detail: k.detail, amount: k.amount });
    }
  }

  return plan;
}

/** 计划新增的行数 */
export function copyCreatedCount(plan: CopyPlan): number {
  return plan.topsToCreate.length + plan.children.length;
}

/** 计划新增的金额合计：独立条目的金额 + 子项金额（新建分组记 0，不影响） */
export function copyTotal(plan: CopyPlan): number {
  return sumAmounts([...plan.topsToCreate.map((t) => t.amount), ...plan.children.map((c) => c.amount)]);
}
