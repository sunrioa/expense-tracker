import { Hono } from 'hono';
import { ok } from '../http/response';

/** 健康检查，供 docker healthcheck 使用 */
export function healthRoutes() {
  return new Hono().get('/health', (c) =>
    c.json(
      ok({
        status: 'UP',
        service: 'expense-tracker-server',
        time: new Date().toISOString()
      })
    )
  );
}
