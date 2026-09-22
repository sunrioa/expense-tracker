package com.ledger.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 树形展示节点
 */
public class RecordNode {

    private Long id;
    private Long parentId;
    private String name;
    private String detail;
    /** 自身落库金额（叶子节点才有意义） */
    private BigDecimal amount;
    /** 展示金额：有子项时 = 所有子项汇总；否则 = 自身金额 */
    private BigDecimal subtotal;
    /** 归属月份 yyyy-MM */
    private String period;
    private Integer sortOrder;
    private boolean hasChildren;
    /** 金额是否可编辑：有子项的节点由子项汇总，不可直接改 */
    private boolean amountEditable;
    /** 深度，0 为顶级 */
    private int depth;
    /** 完整路径，例如「交通 / 单车」 */
    private String path;
    private List<RecordNode> children = new ArrayList<>();

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

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
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

    public boolean isHasChildren() {
        return hasChildren;
    }

    public void setHasChildren(boolean hasChildren) {
        this.hasChildren = hasChildren;
    }

    public boolean isAmountEditable() {
        return amountEditable;
    }

    public void setAmountEditable(boolean amountEditable) {
        this.amountEditable = amountEditable;
    }

    public int getDepth() {
        return depth;
    }

    public void setDepth(int depth) {
        this.depth = depth;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public List<RecordNode> getChildren() {
        return children;
    }

    public void setChildren(List<RecordNode> children) {
        this.children = children;
    }
}
