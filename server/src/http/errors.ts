import { InvalidPeriodError } from '@ledger/shared';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { BusinessError } from '../domain/errors';
import { fail } from './response';

/**
 * 全局错误处理，对应原 GlobalExceptionHandler。
 *
 * 业务异常 → 400 + 可读文案；其余 → 500 并打日志。
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof BusinessError || err instanceof InvalidPeriodError) {
    return c.json(fail(err.message), 400);
  }
  if (err instanceof HTTPException) {
    return c.json(fail(err.message), err.status);
  }
  console.error('[error] 系统异常', err);
  return c.json(fail(`服务器异常：${err.message}`), 500);
}
