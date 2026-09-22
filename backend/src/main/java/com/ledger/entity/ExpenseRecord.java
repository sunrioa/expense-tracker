package com.ledger.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;

/**
 * 支出记录（按月记账 · 自关联树结构）
 *
 * <p>一条记录 = 某个月里的一项支出，例如「2026-09 · 吃 · (5+15)*30 · 960」。
 *
 * <p>parent_id 为 null 表示「支出名称」这一层的条目，例如「交通」；
 * 其下可以挂子项，例如「单车 / 公交 / 地铁」，子项还可以继续挂子项。
 *
 * <p>金额规则：只有「叶子节点」的 amount 是真实金额，
 * 有子项的父节点金额由子项自动汇总（不落库、实时计算），从而避免统计时重复累加。
 */
@Entity
@Table(name = "expense_record", indexes = {
        @Index(name = "idx_parent_id", columnList = "parent_id"),
        @Index(name = "idx_period", columnList = "period"),
        @Index(name = "idx_name", columnList = "name")
})
public class ExpenseRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 父项 ID，null 表示顶级（支出名称层） */
    @Column(name = "parent_id")
    private Long parentId;

    /** 支出名称，例如：交通 / 单车 / 吃 */
    @Column(name = "name", nullable = false, length = 64)
    private String name;

    /** 支出详细，例如：(5+15)*30 / 单车 80、公交 60、地铁 120 */
    @Column(name = "detail", length = 255)
    private String detail;

    /** 支出金额（叶子节点有效，按月合计） */
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    /** 归属月份，格式 yyyy-MM，例如 2026-09 */
    @Column(name = "period", length = 7)
    private String period;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.period == null || this.period.isBlank()) {
            this.period = YearMonth.now().toString();
        }
        if (this.amount == null) {
            this.amount = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
