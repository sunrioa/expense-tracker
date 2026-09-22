package com.ledger.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * 新增一条支出记录（按月记账）
 */
public class RecordRequest {

    /** 父项 ID，null 表示顶级条目 */
    private Long parentId;

    @NotBlank(message = "支出名称不能为空")
    @Size(max = 64, message = "支出名称最长 64 个字符")
    private String name;

    @Size(max = 255, message = "支出详细最长 255 个字符")
    private String detail;

    @NotNull(message = "支出金额不能为空")
    @DecimalMin(value = "0", message = "支出金额不能为负数")
    private BigDecimal amount;

    /** 归属月份 yyyy-MM，缺省为当前月 */
    @Pattern(regexp = "^\\d{4}-\\d{2}$", message = "归属月份格式应为 yyyy-MM")
    private String period;

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
}
