/**
 * 领域层的一行记录。
 *
 * 和数据库表结构的区别：amount 已经从 DECIMAL 字符串解析成 number，
 * period 已经保证非空。领域层只认这个类型，不认 Drizzle，
 * 所以整套业务逻辑可以脱离数据库单独测试 —— 原来的 Java 版做不到这点，
 * 它的 collectWithDescendants 之类会直接回头查 repository。
 */
export interface ExpenseRow {
  id: number;
  parentId: number | null;
  name: string;
  detail: string | null;
  amount: number;
  period: string;
  sortOrder: number | null;
}

/** 待插入的新行（还没有 id） */
export interface NewExpenseRow {
  parentId: number | null;
  name: string;
  detail: string | null;
  amount: number;
  period: string;
}

/** 树 / 列表查询的过滤条件 */
export interface RecordFilter {
  from?: string;
  to?: string;
  keyword?: string;
}
