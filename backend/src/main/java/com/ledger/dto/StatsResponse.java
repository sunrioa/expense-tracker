package com.ledger.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 统计结果（按月 / 按年）
 */
public class StatsResponse {

    /** month 或 year */
    private String granularity;
    /** 实际统计的月份区间 yyyy-MM */
    private String fromPeriod;
    private String toPeriod;

    /** 合计金额 */
    private BigDecimal total = BigDecimal.ZERO;
    /** 明细条数（只统计叶子节点，避免父子重复累加） */
    private long recordCount;
    /** 覆盖月份数 */
    private long monthCount;
    /** 平均每月支出 */
    private BigDecimal avgPerMonth = BigDecimal.ZERO;
    /** 最大单笔 */
    private BigDecimal maxAmount = BigDecimal.ZERO;
    private String maxAmountName;
    private String maxAmountPeriod;

    /** 按支出名称（叶子名称）汇总 */
    private List<NameStat> byName = new ArrayList<>();
    /** 按顶级分类汇总 */
    private List<NameStat> byCategory = new ArrayList<>();
    /** 按期间（月 / 年）汇总 */
    private List<PeriodStat> byPeriod = new ArrayList<>();

    public static class NameStat {
        private String name;
        private BigDecimal total = BigDecimal.ZERO;
        private long count;
        private double percent;
        private String color;

        public NameStat() {
        }

        public NameStat(String name, BigDecimal total, long count, double percent) {
            this.name = name;
            this.total = total;
            this.count = count;
            this.percent = percent;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public BigDecimal getTotal() {
            return total;
        }

        public void setTotal(BigDecimal total) {
            this.total = total;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public double getPercent() {
            return percent;
        }

        public void setPercent(double percent) {
            this.percent = percent;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }
    }

    public static class PeriodStat {
        /** 排序键，例如 2026-09（月）或 2026（年） */
        private String key;
        /** 展示标签，例如「2026年09月」或「2026年」 */
        private String label;
        private BigDecimal total = BigDecimal.ZERO;
        private long count;
        private double percent;

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public BigDecimal getTotal() {
            return total;
        }

        public void setTotal(BigDecimal total) {
            this.total = total;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public double getPercent() {
            return percent;
        }

        public void setPercent(double percent) {
            this.percent = percent;
        }
    }

    public String getGranularity() {
        return granularity;
    }

    public void setGranularity(String granularity) {
        this.granularity = granularity;
    }

    public String getFromPeriod() {
        return fromPeriod;
    }

    public void setFromPeriod(String fromPeriod) {
        this.fromPeriod = fromPeriod;
    }

    public String getToPeriod() {
        return toPeriod;
    }

    public void setToPeriod(String toPeriod) {
        this.toPeriod = toPeriod;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public long getRecordCount() {
        return recordCount;
    }

    public void setRecordCount(long recordCount) {
        this.recordCount = recordCount;
    }

    public long getMonthCount() {
        return monthCount;
    }

    public void setMonthCount(long monthCount) {
        this.monthCount = monthCount;
    }

    public BigDecimal getAvgPerMonth() {
        return avgPerMonth;
    }

    public void setAvgPerMonth(BigDecimal avgPerMonth) {
        this.avgPerMonth = avgPerMonth;
    }

    public BigDecimal getMaxAmount() {
        return maxAmount;
    }

    public void setMaxAmount(BigDecimal maxAmount) {
        this.maxAmount = maxAmount;
    }

    public String getMaxAmountName() {
        return maxAmountName;
    }

    public void setMaxAmountName(String maxAmountName) {
        this.maxAmountName = maxAmountName;
    }

    public String getMaxAmountPeriod() {
        return maxAmountPeriod;
    }

    public void setMaxAmountPeriod(String maxAmountPeriod) {
        this.maxAmountPeriod = maxAmountPeriod;
    }

    public List<NameStat> getByName() {
        return byName;
    }

    public void setByName(List<NameStat> byName) {
        this.byName = byName;
    }

    public List<NameStat> getByCategory() {
        return byCategory;
    }

    public void setByCategory(List<NameStat> byCategory) {
        this.byCategory = byCategory;
    }

    public List<PeriodStat> getByPeriod() {
        return byPeriod;
    }

    public void setByPeriod(List<PeriodStat> byPeriod) {
        this.byPeriod = byPeriod;
    }
}
