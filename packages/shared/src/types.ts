import type { Period } from './period';

/**
 * 响应体类型。
 *
 * 这个文件**不依赖 zod** —— 浏览器只需要类型，不该为了类型把一个校验库
 * 打进包里。运行时校验的 schema 全在 ./schemas.ts，只有服务端会加载。
 */

/* ============================================================ 响应包装 */

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/* ============================================================ 响应体
 *
 * 可空字段一律用 `?:` 而不是 `| null`：服务端序列化时缺席的字段直接不出现在
 * JSON 里（JSON.stringify 会丢掉 undefined），与原 Jackson 的
 * default-property-inclusion: non_null 行为保持一致，前端无需改动。
 */

/** 树节点 */
export interface RecordNode {
  id: number;
  parentId?: number;
  name: string;
  detail?: string;
  /** 本节点自身金额 */
  amount?: number;
  /** 含全部子项的汇总金额 */
  subtotal?: number;
  period: Period;
  sortOrder?: number;
  hasChildren: boolean;
  amountEditable: boolean;
  depth: number;
  /** 形如「交通 / 地铁」的完整路径 */
  path?: string;
  children: RecordNode[];
}

/** 父项下拉选项 */
export interface RecordOption {
  id: number;
  label: string;
  name: string;
  period: Period;
  depth: number;
  hasChildren: boolean;
}

/** 批量生成结果 */
export interface BatchFillResult {
  created: number;
  skipped: number;
  parentCreated: number;
  parentName?: string;
  /** 覆盖的月份数 */
  months: number;
  totalAmount: number;
}

/** 复制整月的结果 */
export interface CopyMonthResult {
  /** 新增了几行（顶级条目 + 子项） */
  created: number;
  /** 目标月已有同名条目而跳过的行数 */
  skipped: number;
  /** 新增行的金额合计（分组本身不计金额） */
  totalAmount: number;
}

/** 删除结果 */
export interface DeleteResult {
  /** 连同子项一共删掉几行 */
  deleted: number;
}

/** 按名称 / 按分类的统计项 */
export interface NameStat {
  name: string;
  total: number;
  count: number;
  percent: number;
  color: string;
}

/** 按月 / 按年的统计项 */
export interface PeriodStat {
  /** 原始值：按月是 2026-09，按年是 2026 */
  key: string;
  /** 展示用标签 */
  label: string;
  total: number;
  count: number;
  percent: number;
}

export type Granularity = 'month' | 'year';

/** 统计响应 */
export interface StatsResponse {
  granularity: Granularity;
  fromPeriod?: Period;
  toPeriod?: Period;
  total: number;
  recordCount: number;
  monthCount: number;
  avgPerMonth: number;
  maxAmount: number;
  maxAmountName?: string;
  maxAmountPeriod?: Period;
  byName: NameStat[];
  byCategory: NameStat[];
  byPeriod: PeriodStat[];
}

export interface HealthResponse {
  status: string;
  time: string;
}
