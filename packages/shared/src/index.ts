export * from './money';
export * from './period';
export * from './types';

/**
 * 请求体类型从 schemas 推导而来。这里用 `export type` 而不是 `export *`：
 * 类型导出会被编译器完全抹掉，所以前端不会因此把 zod 打进产物。
 * 服务端需要 schema 本身时直接 import '@ledger/shared/schemas'。
 */
export type {
  BatchFillItem,
  BatchFillRequest,
  CopyMonthRequest,
  OptionsQuery,
  RangeQuery,
  RecordPatch,
  RecordRequest,
  StatsQuery
} from './schemas';
