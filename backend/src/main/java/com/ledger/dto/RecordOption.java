package com.ledger.dto;

/**
 * 父项下拉选项
 */
public class RecordOption {

    private Long id;
    private String label;
    private String name;
    /** 该条目归属的月份 yyyy-MM */
    private String period;
    private int depth;
    private boolean hasChildren;

    public RecordOption() {
    }

    public RecordOption(Long id, String label, String name, String period, int depth, boolean hasChildren) {
        this.id = id;
        this.label = label;
        this.name = name;
        this.period = period;
        this.depth = depth;
        this.hasChildren = hasChildren;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public int getDepth() {
        return depth;
    }

    public void setDepth(int depth) {
        this.depth = depth;
    }

    public boolean isHasChildren() {
        return hasChildren;
    }

    public void setHasChildren(boolean hasChildren) {
        this.hasChildren = hasChildren;
    }
}
