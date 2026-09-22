import type { ExpenseRow, NewExpenseRow } from '../domain/types';

/**
 * 记录仓储。
 *
 * 领域逻辑全部是纯函数，只通过这个接口拿数据 —— 所以业务逻辑能脱离数据库测试，
 * 本地演示也能用内存实现直接跑起来。原 Java 版把 repository 直接注入 service、
 * 还在 collectWithDescendants 里回头查库，导致核心逻辑没法单测。
 */
export interface RecordRepository {
  /** 全量读取，按 id 升序。数据量是个人记账级别，全量读进内存再计算足够了。 */
  findAll(): Promise<ExpenseRow[]>;
  findById(id: number): Promise<ExpenseRow | undefined>;
  insert(row: NewExpenseRow): Promise<ExpenseRow>;
  insertMany(rows: NewExpenseRow[]): Promise<number>;
  update(id: number, patch: Partial<NewExpenseRow>): Promise<void>;
  /** 批量把若干行的月份改成同一个值（改父项月份时带着子孙一起走） */
  updatePeriods(ids: number[], period: string): Promise<void>;
  deleteMany(ids: number[]): Promise<number>;
  /** 释放连接等资源 */
  close(): Promise<void>;
}
