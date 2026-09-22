import { currentPeriod, roundAmount } from '@ledger/shared';
import type { ExpenseRow } from '../domain/types';
import type { RecordRepository } from './repository';

/**
 * 内存仓储。
 *
 * 用途有两个：单元测试，以及没有 MySQL 时在本地把界面跑起来看效果。
 * **数据只活在进程里，重启即失**，不要用于任何真实记账。
 */
export function createMemoryRepository(seed: ExpenseRow[] = []): RecordRepository {
  const rows = new Map<number, ExpenseRow>();
  let nextId = 1;

  for (const r of seed) {
    rows.set(r.id, { ...r });
    nextId = Math.max(nextId, r.id + 1);
  }

  const sorted = () => [...rows.values()].sort((a, b) => a.id - b.id);

  return {
    async findAll() {
      return sorted().map((r) => ({ ...r }));
    },
    async findById(id) {
      const r = rows.get(id);
      return r ? { ...r } : undefined;
    },
    async insert(row) {
      const created: ExpenseRow = {
        id: nextId++,
        parentId: row.parentId,
        name: row.name,
        detail: row.detail,
        amount: roundAmount(row.amount),
        period: row.period || currentPeriod(),
        sortOrder: 0
      };
      rows.set(created.id, created);
      return { ...created };
    },
    async insertMany(list) {
      for (const row of list) await this.insert(row);
      return list.length;
    },
    async update(id, patch) {
      const cur = rows.get(id);
      if (!cur) return;
      rows.set(id, {
        ...cur,
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
        ...(patch.amount !== undefined ? { amount: roundAmount(patch.amount) } : {}),
        ...(patch.period !== undefined ? { period: patch.period } : {})
      });
    },
    async updatePeriods(ids, period) {
      for (const id of ids) {
        const cur = rows.get(id);
        if (cur) rows.set(id, { ...cur, period });
      }
    },
    async deleteMany(ids) {
      let n = 0;
      for (const id of ids) if (rows.delete(id)) n++;
      return n;
    },
    async close() {
      rows.clear();
    }
  };
}
