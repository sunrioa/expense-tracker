package com.ledger.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 轻量在线迁移。
 *
 * <p>历史版本按「具体日期」记账（expense_date 列），现在改为按「月份」记账（period 列）。
 * 启动时把老数据的月份从日期推导出来，然后删掉不再使用的日期列，保证老库可以直接升级。
 *
 * <p>整个过程幂等：列不存在就跳过，可以反复执行。
 */
@Component
public class SchemaMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigration.class);

    private final JdbcTemplate jdbc;

    public SchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!tableExists("expense_record")) {
                return;
            }
            if (columnExists("expense_record", "expense_date")) {
                if (!columnExists("expense_record", "period")) {
                    jdbc.execute("ALTER TABLE expense_record ADD COLUMN period VARCHAR(7) NULL");
                    log.info("[migration] 已新增 period 列");
                }
                int n = jdbc.update("UPDATE expense_record SET period = DATE_FORMAT(expense_date, '%Y-%m') "
                        + "WHERE period IS NULL OR period = ''");
                log.info("[migration] 按 expense_date 回填 period 共 {} 行", n);
                jdbc.execute("ALTER TABLE expense_record DROP COLUMN expense_date");
                log.info("[migration] 已移除历史列 expense_date");
            }
            int fixed = jdbc.update("UPDATE expense_record SET period = DATE_FORMAT(CURDATE(), '%Y-%m') "
                    + "WHERE period IS NULL OR period = ''");
            if (fixed > 0) {
                log.info("[migration] 兜底补全 period 共 {} 行", fixed);
            }
        } catch (Exception e) {
            // 迁移失败不应该阻断启动，只记录；应用层对空 period 也有兜底
            log.warn("[migration] 迁移未完成：{}", e.getMessage());
        }
    }

    private boolean tableExists(String table) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                Integer.class, table);
        return n != null && n > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = ? AND column_name = ?",
                Integer.class, table, column);
        return n != null && n > 0;
    }
}
