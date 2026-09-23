import { z } from 'zod';

/**
 * 环境变量。
 *
 * 启动时一次性校验并给出默认值 —— 少一个环境变量就在启动时报错，
 * 而不是等到第一次请求打过来才炸。默认值与原 application.yml 保持一致。
 */
const envSchema = z.object({
  /** mysql = 正式；memory = 本地演示 / 测试，数据重启即失 */
  DB_DRIVER: z.enum(['mysql', 'memory']).default('mysql'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('expense_tracker'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default('root'),
  SERVER_PORT: z.coerce.number().int().positive().default(8080),
  TZ: z.string().default('Asia/Shanghai'),
  /** 内存模式下是否灌入演示数据 */
  SEED_DEMO: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true')
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('；');
    throw new Error(`环境变量不合法 —— ${msg}`);
  }
  return parsed.data;
}
