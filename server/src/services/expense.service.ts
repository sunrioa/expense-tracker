import { currentPeriod, normalizePeriod, roundAmount } from '@ledger/shared';
import type {
  BatchFillRequest,
  BatchFillResult,
  CopyMonthRequest,
  CopyMonthResult,
  DeleteResult,
  Period,
  RecordNode,
  RecordOption,
  RecordPatch,
  RecordRequest
} from '@ledger/shared';
import type { RecordRepository } from '../db/repository';
import { planBatchFill, plannedTotal } from '../domain/batch';
import { copyCreatedCount, copyTotal, planCopyMonth } from '../domain/copy';
import { BusinessError } from '../domain/errors';
import {
  buildForest,
  buildLeaves,
  buildOptions,
  collectWithDescendants,
  distinctPeriods,
  indexById,
  isDescendant,
  toLeafNode
} from '../domain/tree';
import type { NewExpenseRow, RecordFilter } from '../domain/types';

/** 去空白，空串当成 null —— 对应 Java 版的 toStr */
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function clip(s: string | null, max: number): string | null {
  if (s === null) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function toId(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  const raw = String(v).trim();
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n)) throw new BusinessError(`非法的 ID：${v}`);
  return n;
}

/**
 * 记账服务。
 *
 * 金额规则：只有叶子节点落库真实金额，父项由子项实时汇总，
 * 避免统计时父子重复累加。
 */
export function createExpenseService(repo: RecordRepository) {
  async function tree(filter: RecordFilter): Promise<RecordNode[]> {
    return buildForest(await repo.findAll(), filter);
  }

  async function leaves(filter: RecordFilter): Promise<RecordNode[]> {
    return buildLeaves(await repo.findAll(), filter);
  }

  async function options(period?: string): Promise<RecordOption[]> {
    return buildOptions(await repo.findAll(), period);
  }

  async function periods(): Promise<Period[]> {
    return distinctPeriods(await repo.findAll());
  }

  async function create(request: RecordRequest): Promise<RecordNode> {
    const parentId = request.parentId ?? null;
    let period = normalizePeriod(request.period) ?? currentPeriod();

    if (parentId !== null) {
      const parent = await repo.findById(parentId);
      if (!parent) throw new BusinessError('父项不存在，无法添加子项');
      // 只允许两级：子项下不能再挂子项
      if (parent.parentId !== null) {
        throw new BusinessError(
          `「${parent.name}」已经是子项，子项下不能再添加子项；请把新条目加到顶级条目下`
        );
      }
      // 子项默认跟随父项月份，避免父子跨月对不上
      if (!request.period || request.period.trim() === '') period = parent.period;
    }

    const saved = await repo.insert({
      parentId,
      name: request.name.trim(),
      detail: toStr(request.detail),
      amount: roundAmount(request.amount),
      period
    });
    return toLeafNode(saved, indexById(await repo.findAll()));
  }

  /**
   * 局部更新：只更新请求里**出现过**的字段。
   * 界面上改一个单元格只提交那一个字段，不能把其它字段清空。
   */
  async function update(id: number, patch: RecordPatch): Promise<RecordNode> {
    const rows = await repo.findAll();
    const entity = rows.find((r) => r.id === id);
    if (!entity) throw new BusinessError(`记录不存在：${id}`);

    const changes: Partial<NewExpenseRow> = {};

    if (Object.hasOwn(patch, 'parentId')) {
      const v = patch.parentId;
      if (v === null || v === undefined || String(v).trim() === '') {
        changes.parentId = null;
      } else {
        const pid = toId(v);
        if (pid === id) throw new BusinessError('不能把自己设为自己的父项');
        if (isDescendant(rows, id, pid)) {
          throw new BusinessError('不能把子项设为自己的父项（会形成环）');
        }
        const target = rows.find((r) => r.id === pid);
        if (!target) throw new BusinessError(`父项不存在：${pid}`);
        if (target.parentId !== null) {
          throw new BusinessError(
            `「${target.name}」已经是子项，子项下不能再添加子项；请挂到顶级条目下`
          );
        }
        changes.parentId = pid;
      }
    }

    if (Object.hasOwn(patch, 'name')) {
      const name = toStr(patch.name);
      if (name === null) throw new BusinessError('支出名称不能为空');
      if (name.length > 64) throw new BusinessError('支出名称最长 64 个字符');
      changes.name = name;
    }

    if (Object.hasOwn(patch, 'detail')) {
      changes.detail = clip(toStr(patch.detail), 255);
    }

    if (Object.hasOwn(patch, 'amount')) {
      const v = patch.amount;
      if (v === null || v === undefined || String(v).trim() === '') {
        changes.amount = 0;
      } else {
        const n = Number(String(v).trim());
        if (!Number.isFinite(n)) throw new BusinessError(`支出金额格式不正确：${v}`);
        if (n < 0) throw new BusinessError('支出金额不能为负数');
        changes.amount = roundAmount(n);
      }
    }

    // 改月份时把子孙一起带过去，保证父子同月（否则按月筛选后父子会分散）
    let cascadePeriod: string | undefined;
    if (Object.hasOwn(patch, 'period')) {
      const p = normalizePeriod(toStr(patch.period));
      if (p && p !== entity.period) {
        changes.period = p;
        cascadePeriod = p;
      }
    }

    await repo.update(id, changes);

    if (cascadePeriod) {
      const descendants = collectWithDescendants(rows, id).filter((x) => x !== id);
      if (descendants.length > 0) await repo.updatePeriods(descendants, cascadePeriod);
    }

    const after = await repo.findAll();
    const saved = after.find((r) => r.id === id);
    if (!saved) throw new BusinessError(`记录不存在：${id}`);
    return toLeafNode(saved, indexById(after));
  }

  /** 删除节点及其所有子孙 */
  async function remove(id: number): Promise<DeleteResult> {
    const rows = await repo.findAll();
    if (!rows.some((r) => r.id === id)) throw new BusinessError(`记录不存在：${id}`);
    const ids = collectWithDescendants(rows, id);
    await repo.deleteMany(ids);
    return { deleted: ids.length };
  }

  /**
   * 按月批量生成：把 items × 月份区间 铺成多行。
   *
   * 规划是纯函数（planBatchFill），这里只负责落库：先插该月的父项拿到真实 id，
   * 再把子项的父项占位符换成真实 id 后批量插入。
   */
  async function batchFill(request: BatchFillRequest): Promise<BatchFillResult> {
    const rows = await repo.findAll();
    const plan = planBatchFill(rows, request);

    const newParentIds = new Map<string, number>();
    for (const p of plan.parentsToCreate) {
      const created = await repo.insert({
        parentId: null,
        name: p.name,
        detail: p.detail,
        amount: 0,
        period: p.period
      });
      newParentIds.set(p.period, created.id);
    }

    const toInsert: NewExpenseRow[] = plan.items.map((it) => ({
      parentId:
        it.parent.kind === 'existing'
          ? it.parent.id
          : it.parent.kind === 'new'
            ? (newParentIds.get(it.parent.period) ?? null)
            : null,
      name: it.name,
      detail: it.detail,
      amount: it.amount,
      period: it.period
    }));
    await repo.insertMany(toInsert);

    return {
      created: toInsert.length,
      skipped: plan.skipped,
      parentCreated: plan.parentsToCreate.length,
      parentName: plan.parentName,
      months: plan.months.length,
      totalAmount: plannedTotal(plan)
    };
  }

  /**
   * 整月复制：规划同样是纯函数（planCopyMonth）。落库顺序和批量生成一样 ——
   * 先插新的顶级条目拿到真实 id，再把子项的占位引用换成真实 id 批量插入。
   */
  async function copyMonth(request: CopyMonthRequest): Promise<CopyMonthResult> {
    const plan = planCopyMonth(await repo.findAll(), request.from, request.to);

    const newIds = new Map<number, number>();
    for (const t of plan.topsToCreate) {
      const created = await repo.insert({
        parentId: null,
        name: t.name,
        detail: t.detail,
        amount: t.amount,
        period: plan.to
      });
      newIds.set(t.sourceId, created.id);
    }

    await repo.insertMany(
      plan.children.map((c) => ({
        parentId: c.parent.kind === 'existing' ? c.parent.id : (newIds.get(c.parent.sourceId) ?? null),
        name: c.name,
        detail: c.detail,
        amount: c.amount,
        period: plan.to
      }))
    );

    return { created: copyCreatedCount(plan), skipped: plan.skipped, totalAmount: copyTotal(plan) };
  }

  return { tree, leaves, options, periods, create, update, remove, batchFill, copyMonth };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
