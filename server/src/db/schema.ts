import { bigint, datetime, decimal, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/**
 * 支出记录（自关联树）。
 *
 * parent_id 为 NULL 表示顶级条目。金额只有叶子节点有效，
 * 父项金额由子项实时汇总，不落库。
 */
export const expenseRecord = mysqlTable(
  'expense_record',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    parentId: bigint('parent_id', { mode: 'number' }),
    name: varchar('name', { length: 64 }).notNull(),
    detail: varchar('detail', { length: 255 }),
    // mysql2 会把 DECIMAL 读成字符串以免丢精度，仓储层负责解析成 number
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    period: varchar('period', { length: 7 }),
    sortOrder: int('sort_order').default(0),
    createdAt: datetime('created_at'),
    updatedAt: datetime('updated_at')
  },
  (t) => [index('idx_parent_id').on(t.parentId), index('idx_name').on(t.name)]
);
