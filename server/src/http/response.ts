/**
 * 统一响应包装 { success, message, data }。
 *
 * 失败时刻意**不带** data 字段：原 Jackson 配了 default-property-inclusion: non_null，
 * null 的字段不会出现在 JSON 里，这里保持一致，前端拦截器无需改动。
 */
export function ok<T>(data: T): { success: true; message: string; data: T } {
  return { success: true, message: 'ok', data };
}

export function fail(message: string): { success: false; message: string } {
  return { success: false, message };
}
