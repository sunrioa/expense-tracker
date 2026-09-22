import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { fail } from './response';

/**
 * zValidator 的薄封装：把 Zod 的报错拼成一条中文消息返回 400。
 *
 * 用「；」连接多条，与原 GlobalExceptionHandler 处理
 * MethodArgumentNotValidException 的方式一致。
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('；');
      return c.json(fail(msg), 400);
    }
    return undefined;
  });
}
