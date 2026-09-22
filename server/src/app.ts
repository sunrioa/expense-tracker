import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { onError } from './http/errors';
import { healthRoutes } from './routes/health';
import { recordRoutes } from './routes/records';
import { statsRoutes } from './routes/stats';
import type { ExpenseService } from './services/expense.service';
import type { StatsService } from './services/stats.service';

export interface AppDeps {
  expense: ExpenseService;
  stats: StatsService;
}

export function createApp({ expense, stats }: AppDeps) {
  const app = new Hono();

  app.onError(onError);

  // 允许前端本地开发（vite dev server）跨域直连。
  // 生产环境由 nginx 反向代理，同源访问，不依赖这段配置。
  app.use(
    '/api/*',
    cors({
      origin: (o) => o ?? '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['*'],
      credentials: true,
      maxAge: 3600
    })
  );

  app.route('/api/records', recordRoutes(expense));
  app.route('/api', statsRoutes(stats));
  app.route('/api', healthRoutes());

  return app;
}

export type AppType = ReturnType<typeof createApp>;
