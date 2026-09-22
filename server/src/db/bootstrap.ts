import { sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';

/**
 * 启动时的建表与在线迁移，完全幂等，可以反复执行。
 *
 * 原 Java 版靠 Hibernate 的 ddl-auto=update 自动建表，再加一个 SchemaMigration
 * 做历史列迁移。这里把两件事合成一个显式步骤 —— 建表语句看得见，
 * 比把 DDL 交给 ORM 猜要可控。
 */
export async function bootstrapSchema(db: MySql2Database): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`expense_record\` (
      \`id\`         BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
      \`parent_id\`  BIGINT        NULL     DEFAULT NULL COMMENT '父项ID，NULL 表示顶级条目',
      \`name\`       VARCHAR(64)   NOT NULL COMMENT '支出名称',
      \`detail\`     VARCHAR(255)  NULL     DEFAULT NULL COMMENT '支出详细说明',
      \`amount\`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '支出金额（仅叶子节点有效）',
      \`period\`     VARCHAR(7)    NULL     DEFAULT NULL COMMENT '归属月份 yyyy-MM',
      \`sort_order\` INT           NULL     DEFAULT 0 COMMENT '排序',
      \`created_at\` DATETIME      NULL     DEFAULT NULL,
      \`updated_at\` DATETIME      NULL     DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_parent_id\` (\`parent_id\`),
      KEY \`idx_period\` (\`period\`),
      KEY \`idx_name\` (\`name\`)
    ) ENGINE = InnoDB
      DEFAULT CHARSET = utf8mb4
      COLLATE = utf8mb4_unicode_ci COMMENT = '支出记录（自关联树）'
  `);

  // 历史库迁移：老版本按具体日期记账（expense_date），现在按月份（period）
  if (await columnExists(db, 'expense_record', 'expense_date')) {
    if (!(await columnExists(db, 'expense_record', 'period'))) {
      await db.execute(sql`ALTER TABLE expense_record ADD COLUMN period VARCHAR(7) NULL`);
      console.log('[migration] 已新增 period 列');
    }
    await db.execute(sql`
      UPDATE expense_record SET period = DATE_FORMAT(expense_date, '%Y-%m')
      WHERE period IS NULL OR period = ''
    `);
    await db.execute(sql`ALTER TABLE expense_record DROP COLUMN expense_date`);
    console.log('[migration] 已按 expense_date 回填 period 并移除历史列');
  }

  // 兜底：仍为空的月份补成当月，避免按月筛选时整行消失
  await db.execute(sql`
    UPDATE expense_record SET period = DATE_FORMAT(CURDATE(), '%Y-%m')
    WHERE period IS NULL OR period = ''
  `);
}

async function columnExists(db: MySql2Database, table: string, column: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT COUNT(*) AS n FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}
  `);
  const first = (rows as unknown as Array<Array<{ n: number | string }>>)[0]?.[0];
  return Number(first?.n ?? 0) > 0;
}
