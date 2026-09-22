/**
 * 后端接口的类型定义。
 *
 * 这里的每个 interface 都一一对应 backend/src/main/java/com/ledger/dto 下的
 * 同名 Java 类，字段名、可空性保持一致。后端改了 DTO，这个文件要跟着改 ——
 * TypeScript 保证的是「前端内部一致」，不是「前后端契约」，别把它当契约用。
 *
 * 可空性依据：application.yml 里配了 default-property-inclusion: non_null，
 * 所以 Java 侧为 null 的字段在 JSON 里直接缺席，对应 TS 的 `?:`；
 * Java 的基本类型（int / long / double / boolean）永远有值，不加 `?`。
 * BigDecimal 默认按 JSON number 序列化，对应 TS 的 number。
 */

/** 月份，格式 yyyy-MM，如 "2026-09" */
export type Period = string;

/** 统计粒度 */
export type Granularity = 'month' | 'year';

/** 统一响应包装 com.ledger.common.ApiResponse */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** 树节点 com.ledger.dto.RecordNode */
export interface RecordNode {
  id: number;
  parentId?: number;
  name: string;
  detail?: string;
  /** 本节点自身金额；有子项时由后端汇总到 subtotal，此处可能缺席 */
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

/** 父项下拉选项 com.ledger.dto.RecordOption */
export interface RecordOption {
  id: number;
  label: string;
  name: string;
  period: Period;
  depth: number;
  hasChildren: boolean;
}

/** 新建记录请求体 com.ledger.dto.RecordRequest */
export interface RecordRequest {
  parentId?: number | null;
  name: string;
  detail?: string;
  amount?: number | null;
  period?: Period | null;
}

/**
 * 部分更新请求体。
 *
 * 后端 ExpenseController#update 收的是 Map<String, Object>，能改哪些字段
 * 只体现在 ExpenseService#update 的实现里。这里把可改字段显式列出来，
 * 避免前端拼错 key 却静默无效。
 */
export type RecordPatch = Partial<{
  name: string;
  detail: string;
  amount: number;
  period: Period;
  parentId: number | null;
  sortOrder: number;
}>;

/** 批量生成的单个子项 com.ledger.dto.BatchFillRequest.BatchItem */
export interface BatchFillItem {
  name: string;
  detail?: string;
  amount: number;
}

/** 批量生成请求体 com.ledger.dto.BatchFillRequest */
export interface BatchFillRequest {
  parentName?: string | null;
  createParentIfMissing?: boolean;
  items: BatchFillItem[];
  fromPeriod: Period;
  toPeriod: Period;
  detailTemplate?: string;
  skipExisting?: boolean;
}

/** 批量生成结果，对应 ExpenseService#batchFill 往 result 里 put 的那几个 key */
export interface BatchFillResult {
  created: number;
  skipped: number;
  parentCreated: number;
  parentName?: string;
  /** 覆盖的月份数 */
  months: number;
  totalAmount: number;
}

/** 删除结果 */
export interface DeleteResult {
  /** 连同子项一共删掉几行 */
  deleted: number;
}

/** 按名称 / 按分类的统计项 com.ledger.dto.StatsResponse.NameStat */
export interface NameStat {
  name: string;
  total: number;
  count: number;
  percent: number;
  color: string;
}

/** 按月 / 按年的统计项 com.ledger.dto.StatsResponse.PeriodStat */
export interface PeriodStat {
  /** 原始值，按月是 2026-09，按年是 2026 */
  key: string;
  /** 展示用标签 */
  label: string;
  total: number;
  count: number;
  percent: number;
}

/** 统计响应 com.ledger.dto.StatsResponse */
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

/* ------------------------------------------------------------ 查询参数 */

/** /records/tree 与 /records/leaves 的查询参数 */
export interface RangeQuery {
  from?: Period;
  to?: Period;
  keyword?: string;
}

/** /records/options 的查询参数 */
export interface OptionsQuery {
  period?: Period;
}

/** /stats 的查询参数 */
export interface StatsQuery {
  from?: Period;
  to?: Period;
  granularity?: Granularity;
}
