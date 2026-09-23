-- =============================================================
-- 记账本 · 初始化脚本
-- 由 MySQL 容器首次启动时自动执行（/docker-entrypoint-initdb.d）
-- 服务端启动时也会做一次幂等建表 + 历史库迁移，即使不执行本脚本也能自动建表
-- =============================================================

CREATE TABLE IF NOT EXISTS `expense_record` (
  `id`           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `parent_id`    BIGINT        NULL     DEFAULT NULL COMMENT '父项ID，NULL 表示顶级条目',
  `name`         VARCHAR(64)   NOT NULL COMMENT '支出名称，如 交通 / 单车 / 早餐',
  `detail`       VARCHAR(255)  NULL     DEFAULT NULL COMMENT '支出详细说明',
  `amount`       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '支出金额（仅叶子节点有效）',
  `period`       VARCHAR(7)    NULL     DEFAULT NULL COMMENT '归属月份 yyyy-MM',
  `sort_order`   INT           NULL     DEFAULT 0 COMMENT '排序',
  `created_at`   DATETIME      NULL     DEFAULT NULL COMMENT '创建时间',
  `updated_at`   DATETIME      NULL     DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_period` (`period`),
  KEY `idx_name` (`name`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT = '支出记录（自关联树）';
