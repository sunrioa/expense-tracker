import { z } from 'zod';

/**
 * 请求体与查询参数的运行时校验规则。
 *
 * 只有服务端需要它。前端通过 index.ts 以 `export type` 的形式拿到推导出来的
 * 类型 —— 类型导出在编译期就被抹掉，zod 不会进前端产物。
 */

/* ============================================================ 请求体 */

/** 严格的 yyyy-MM。用于新建记录这种必须规范的入口。 */
export const strictPeriodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, '归属月份格式应为 yyyy-MM');

/**
 * 宽松月份：交给服务端的 normalizePeriod 去归一化
 * （接受 2026-9 / 2026/09 / 2026年9月 等写法），非法时由它抛 400。
 */
export const loosePeriodSchema = z.string();

/** POST /api/records —— 对应原 RecordRequest 上的 Jakarta 校验注解 */
export const recordRequestSchema = z.object({
  parentId: z.number('父项 ID 必须是数字').int().positive().nullish(),
  name: z
    .string('支出名称不能为空')
    .trim()
    .min(1, '支出名称不能为空')
    .max(64, '支出名称最长 64 个字符'),
  detail: z.string().max(255, '支出详细最长 255 个字符').nullish(),
  amount: z.number('支出金额不能为空').min(0, '支出金额不能为负数'),
  period: strictPeriodSchema.nullish()
});
export type RecordRequest = z.infer<typeof recordRequestSchema>;

/**
 * PUT /api/records/:id —— 局部更新。
 *
 * 只更新请求里**出现过**的字段：界面上改一个单元格只提交那一个字段，
 * 不能把其它字段清空。所以这里刻意保持宽松，具体的长度 / 负数 / 格式校验
 * 放在 service 里做，好让报错文案和原 Java 版逐字一致。
 */
export const recordPatchSchema = z
  .object({
    name: z.union([z.string(), z.number(), z.null()]),
    detail: z.union([z.string(), z.number(), z.null()]),
    amount: z.union([z.number(), z.string(), z.null()]),
    period: z.union([z.string(), z.null()]),
    parentId: z.union([z.number(), z.string(), z.null()]),
    sortOrder: z.union([z.number(), z.string(), z.null()])
  })
  .partial();
export type RecordPatch = z.infer<typeof recordPatchSchema>;

/** 批量生成的单个子项 */
export const batchFillItemSchema = z.object({
  name: z.string().nullish(),
  detail: z.string().nullish(),
  amount: z.number().nullish()
});
export type BatchFillItem = z.infer<typeof batchFillItemSchema>;

/** POST /api/records/batch */
export const batchFillRequestSchema = z.object({
  parentName: z.string().nullish(),
  createParentIfMissing: z.boolean().default(true),
  items: z.array(batchFillItemSchema).default([]),
  fromPeriod: loosePeriodSchema.nullish(),
  toPeriod: loosePeriodSchema.nullish(),
  detailTemplate: z.string().nullish(),
  skipExisting: z.boolean().default(true)
});
export type BatchFillRequest = z.infer<typeof batchFillRequestSchema>;

/* ============================================================ 查询参数 */

/** /records/tree 与 /records/leaves */
export const rangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  keyword: z.string().optional()
});
export type RangeQuery = z.infer<typeof rangeQuerySchema>;

/** /records/options */
export const optionsQuerySchema = z.object({
  period: z.string().optional()
});
export type OptionsQuery = z.infer<typeof optionsQuerySchema>;

/**
 * /stats —— granularity 刻意不用 z.enum：
 * 原 Java 版是「不等于 year 就按 month」，传了乱七八糟的值也不报错。
 * 保持这个宽容行为，避免前端老版本传值时直接 400。
 */
export const statsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.string().optional()
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;
