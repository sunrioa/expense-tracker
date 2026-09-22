import { asc, eq, inArray } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { parseAmount, toDecimalString } from '@ledger/shared';
import type { ExpenseRow } from '../domain/types';
import type { Env } from '../env';
import { bootstrapSchema } from './bootstrap';
import type { RecordRepository } from './repository';
import { expenseRecord } from './schema';

type Selected = typeof expenseRecord.$inferSelect;

/** 数据库行 → 领域行：DECIMAL 字符串解析成 number，period 兜底成空串 */
function toDomain(r: Selected): ExpenseRow {
  return {
    id: r.id,
    parentId: r.parentId ?? null,
    name: r.name,
    detail: r.detail ?? null,
    amount: parseAmount(r.amount),
    period: r.period ?? '',
    sortOrder: r.sortOrder ?? null
  };
}

export interface MySqlRepository extends RecordRepository {
  readonly db: MySql2Database;
}

export async function createMySqlRepository(env: Env): Promise<MySqlRepository> {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    timezone: '+08:00',
    connectionLimit: 10,
    connectTimeout: 30_000,
    // DECIMAL 保持字符串，交给 parseAmount 统一换算，避免驱动层做浮点转换丢精度
    decimalNumbers: false
  });

  const db = drizzle(pool);
  await bootstrapSchema(db);

  const now = () => new Date();

  const repo: MySqlRepository = {
    db,

    async findAll() {
      const rows = await db.select().from(expenseRecord).orderBy(asc(expenseRecord.id));
      return rows.map(toDomain);
    },

    async findById(id) {
      const rows = await db.select().from(expenseRecord).where(eq(expenseRecord.id, id)).limit(1);
      return rows[0] ? toDomain(rows[0]) : undefined;
    },

    async insert(row) {
      const ts = now();
      const result = await db.insert(expenseRecord).values({
        parentId: row.parentId,
        name: row.name,
        detail: row.detail,
        amount: toDecimalString(row.amount),
        period: row.period,
        sortOrder: 0,
        createdAt: ts,
        updatedAt: ts
      });
      const insertId = Number(result[0].insertId);
      const created = await this.findById(insertId);
      if (!created) throw new Error(`写入成功但读不回来：id=${insertId}`);
      return created;
    },

    async insertMany(list) {
      if (list.length === 0) return 0;
      const ts = now();
      await db.insert(expenseRecord).values(
        list.map((row) => ({
          parentId: row.parentId,
          name: row.name,
          detail: row.detail,
          amount: toDecimalString(row.amount),
          period: row.period,
          sortOrder: 0,
          createdAt: ts,
          updatedAt: ts
        }))
      );
      return list.length;
    },

    async update(id, patch) {
      await db
        .update(expenseRecord)
        .set({
          ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
          ...(patch.amount !== undefined ? { amount: toDecimalString(patch.amount) } : {}),
          ...(patch.period !== undefined ? { period: patch.period } : {}),
          updatedAt: now()
        })
        .where(eq(expenseRecord.id, id));
    },

    async updatePeriods(ids, period) {
      if (ids.length === 0) return;
      await db
        .update(expenseRecord)
        .set({ period, updatedAt: now() })
        .where(inArray(expenseRecord.id, ids));
    },

    async deleteMany(ids) {
      if (ids.length === 0) return 0;
      await db.delete(expenseRecord).where(inArray(expenseRecord.id, ids));
      return ids.length;
    },

    async close() {
      await pool.end();
    }
  };

  return repo;
}
