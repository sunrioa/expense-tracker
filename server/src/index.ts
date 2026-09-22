import { createApp } from './app';
import { createMemoryRepository } from './db/memory';
import { createMySqlRepository } from './db/mysql';
import type { RecordRepository } from './db/repository';
import { demoRows } from './db/seed';
import { loadEnv } from './env';
import { createExpenseService } from './services/expense.service';
import { createStatsService } from './services/stats.service';

const env = loadEnv();

const repo: RecordRepository =
  env.DB_DRIVER === 'memory'
    ? createMemoryRepository(env.SEED_DEMO ? demoRows() : [])
    : await createMySqlRepository(env);

if (env.DB_DRIVER === 'memory') {
  console.warn('[server] 使用内存存储，数据重启即失 —— 仅用于本地演示和测试');
}

const app = createApp({
  expense: createExpenseService(repo),
  stats: createStatsService(repo)
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void repo.close().finally(() => process.exit(0));
  });
}

console.log(`[server] http://localhost:${env.SERVER_PORT}  driver=${env.DB_DRIVER}`);

export default {
  port: env.SERVER_PORT,
  fetch: app.fetch
};
