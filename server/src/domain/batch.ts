import { normalizePeriod, periodRange, sumAmounts } from '@ledger/shared';
import type { BatchFillRequest } from '@ledger/shared';
import { BusinessError } from './errors';
import type { ExpenseRow } from './types';

/** 单次批量生成最多产生的行数，防误操作 */
export const BATCH_LIMIT = 5000;
/** 单次批量生成最多跨多少个月 */
export const BATCH_MONTH_LIMIT = 120;

/** 新建父项时写入的默认说明 */
const PARENT_DETAIL = '月度汇总';

/** 待插入子项的父项引用 */
export type ParentRef =
  | { kind: 'existing'; id: number }
  | { kind: 'new'; period: string }
  | { kind: 'none' };

export interface BatchPlanItem {
  period: string;
  parent: ParentRef;
  name: string;
  detail: string | null;
  amount: number;
}

export interface BatchPlan {
  months: string[];
  parentName?: string;
  /** 需要新建的父项，每个月最多一个 */
  parentsToCreate: { period: string; name: string; detail: string }[];
  items: BatchPlanItem[];
  skipped: number;
}

/**
 * 判重键：同一个父项下、同一个月、同名，视为同一条。
 * 名称大小写不敏感，与原 Java 版 dedupKey 一致。
 */
function dedupKey(parent: ParentRef, name: string, period: string): string {
  const p =
    parent.kind === 'existing' ? String(parent.id) : parent.kind === 'new' ? `new:${parent.period}` : 'root';
  return `${p}|${name.toLowerCase()}|${period}`;
}

function trimToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** 渲染详细说明模板，支持 {period} {month} {name} {parent} 占位 */
export function renderDetail(
  template: string | null | undefined,
  fallback: string | null | undefined,
  period: string,
  name: string,
  parentName: string | undefined
): string | null {
  if (!template || template.trim() === '') return trimToNull(fallback);
  const month = period.length === 7 ? period.slice(5) : period;
  const out = template
    .replaceAll('{period}', period)
    .replaceAll('{month}', month)
    .replaceAll('{name}', name)
    .replaceAll('{parent}', parentName ?? '');
  return trimToNull(clip(out, 255));
}

/**
 * 把「若干子项 × 一段月份」铺成待插入的行。
 *
 * 纯函数：不碰数据库。新建的父项此时还没有 id，用 { kind: 'new', period } 占位，
 * 由 service 插入父项后再回填真实 id。这样做和原 Java 版（循环里直接 save 父项
 * 拿 id）行为等价 —— 新父项的 id 必然是全新的，绝不可能命中判重。
 */
export function planBatchFill(rows: ExpenseRow[], request: BatchFillRequest): BatchPlan {
  const from = normalizePeriod(request.fromPeriod);
  const to = normalizePeriod(request.toPeriod);
  if (!from || !to) throw new BusinessError('请选择起始月份和结束月份');
  if (to < from) throw new BusinessError('结束月份不能早于起始月份');

  const items = request.items ?? [];
  if (items.length === 0) throw new BusinessError('请至少填写一个子项');

  const months = periodRange(from, to);
  if (months.length === 0) throw new BusinessError('月份区间不合法');
  if (months.length > BATCH_MONTH_LIMIT) {
    throw new BusinessError(`月份区间过长（超过 ${BATCH_MONTH_LIMIT} 个月），请缩小范围`);
  }

  const planned = months.length * items.length;
  if (planned > BATCH_LIMIT) {
    throw new BusinessError(
      `本次将生成 ${planned} 行，超过 ${BATCH_LIMIT} 行上限，请缩小月份范围或减少子项`
    );
  }

  const parentNameRaw = request.parentName?.trim();
  const parentName = parentNameRaw ? parentNameRaw : undefined;

  // 现有全部记录的判重索引
  const seen = new Set<string>();
  for (const r of rows) {
    const ref: ParentRef = r.parentId === null ? { kind: 'none' } : { kind: 'existing', id: r.parentId };
    seen.add(dedupKey(ref, r.name, r.period));
  }

  const parentsToCreate: BatchPlan['parentsToCreate'] = [];
  const planItems: BatchPlanItem[] = [];
  let skipped = 0;

  for (const month of months) {
    let parent: ParentRef = { kind: 'none' };

    if (parentName) {
      const found = rows.find(
        (r) =>
          r.period === month &&
          r.parentId === null &&
          r.name.toLowerCase() === parentName.toLowerCase()
      );
      if (found) {
        parent = { kind: 'existing', id: found.id };
      } else {
        if (!request.createParentIfMissing) {
          throw new BusinessError(`月份 ${month} 下不存在父项「${parentName}」`);
        }
        parentsToCreate.push({ period: month, name: parentName, detail: PARENT_DETAIL });
        parent = { kind: 'new', period: month };
      }
    }

    for (const item of items) {
      if (!item.name || item.name.trim() === '') continue;
      const name = item.name.trim();
      const key = dedupKey(parent, name, month);
      if (request.skipExisting && seen.has(key)) {
        skipped += 1;
        continue;
      }
      planItems.push({
        period: month,
        parent,
        name,
        detail: renderDetail(request.detailTemplate, item.detail, month, name, parentName),
        amount: item.amount ?? 0
      });
      seen.add(key);
    }
  }

  return { months, parentName, parentsToCreate, items: planItems, skipped };
}

/** 计划里将要写入的金额合计 */
export function plannedTotal(plan: BatchPlan): number {
  return sumAmounts(plan.items.map((i) => i.amount));
}
