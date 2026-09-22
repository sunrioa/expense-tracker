-- =============================================================
-- 可选：示例数据（默认不会自动导入）
-- 想先看看效果，可以执行：
--   docker exec -i ledger-mysql mysql -uroot -pledger_root_pwd expense_tracker < deploy/mysql/demo-data.sql
-- =============================================================

-- 1) 支出名称（父项），铺 2026-04 ~ 2026-09 六个月
INSERT INTO expense_record (parent_id, name, detail, amount, period)
SELECT NULL, n.name, n.detail, 0.00, m.period
FROM (SELECT '2026-04' AS period UNION ALL SELECT '2026-05' UNION ALL SELECT '2026-06'
      UNION ALL SELECT '2026-07' UNION ALL SELECT '2026-08' UNION ALL SELECT '2026-09') m
CROSS JOIN (
  SELECT '交通' AS name, '月度汇总' AS detail
  UNION ALL SELECT '吃', '月度汇总'
) n;

-- 2) 子项：每条会挂到「同名父项」下，并且自动跟随父项的月份
INSERT INTO expense_record (parent_id, name, detail, amount, period)
SELECT p.id, c.name, c.detail, c.amount, p.period
FROM expense_record p
JOIN (
  SELECT '交通' AS parent, '单车' AS name, '共享单车月卡' AS detail, 25.00 AS amount
  UNION ALL SELECT '交通', '公交', '公交卡', 60.00
  UNION ALL SELECT '交通', '地铁', '通勤地铁', 120.00
  UNION ALL SELECT '吃', '早餐', '6 元 × 30 天', 180.00
  UNION ALL SELECT '吃', '午餐', '15 元 × 30 天', 450.00
  UNION ALL SELECT '吃', '晚餐', '11 元 × 30 天', 330.00
) c ON c.parent = p.name
WHERE p.parent_id IS NULL;

-- 3) 没有子项的独立支出（金额直接填）
INSERT INTO expense_record (parent_id, name, detail, amount, period)
SELECT NULL, x.name, x.detail, x.amount, m.period
FROM (SELECT '2026-04' AS period UNION ALL SELECT '2026-05' UNION ALL SELECT '2026-06'
      UNION ALL SELECT '2026-07' UNION ALL SELECT '2026-08' UNION ALL SELECT '2026-09') m
CROSS JOIN (
  SELECT '房租' AS name, '每月固定' AS detail, 3200.00 AS amount
  UNION ALL SELECT '话费', '手机套餐', 59.00
  UNION ALL SELECT '水电燃气', '月度账单', 234.80
) x;

-- 生成结果：
--   交通（子项 单车 25 + 公交 60 + 地铁 120）= 205 / 月
--   吃  （子项 早餐 180 + 午餐 450 + 晚餐 330）= 960 / 月   ← 对应「一个月 960」
--   房租 3200 + 话费 59 + 水电燃气 234.80        = 3493.80 / 月
--   合计 ≈ 4658.80 / 月，六个月 ≈ 27952.80
