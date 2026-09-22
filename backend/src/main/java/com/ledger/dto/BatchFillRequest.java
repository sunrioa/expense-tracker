package com.ledger.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 按月批量生成：把若干子项 × 一段月份，一次性铺成多行记录。
 *
 * <p>场景：房租 3200，一次铺到 2026-01 ~ 2026-12，每个月一条。
 * 或：交通下面有 单车/公交/地铁，一次给每个月都建好这三条定额。
 */
public class BatchFillRequest {

    /** 父项（支出名称）名称，例如「交通」；为空表示直接生成顶级条目 */
    private String parentName;

    /** 父项为空时，是否自动创建 */
    private boolean createParentIfMissing = true;

    /** 要批量生成的子项模板 */
    private List<BatchItem> items = new ArrayList<>();

    /** 起始月份 yyyy-MM */
    private String fromPeriod;

    /** 结束月份 yyyy-MM */
    private String toPeriod;

    /** 详细文本模板，支持占位符 {period} {month} {name} {parent} */
    private String detailTemplate;

    /** 已存在同父项 + 同名 + 同月份时是否跳过，避免重复生成 */
    private boolean skipExisting = true;

    public static class BatchItem {
        private String name;
        private String detail;
        private BigDecimal amount = BigDecimal.ZERO;

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
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public boolean isCreateParentIfMissing() {
        return createParentIfMissing;
    }

    public void setCreateParentIfMissing(boolean createParentIfMissing) {
        this.createParentIfMissing = createParentIfMissing;
    }

    public List<BatchItem> getItems() {
        return items;
    }

    public void setItems(List<BatchItem> items) {
        this.items = items;
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

    public String getDetailTemplate() {
        return detailTemplate;
    }

    public void setDetailTemplate(String detailTemplate) {
        this.detailTemplate = detailTemplate;
    }

    public boolean isSkipExisting() {
        return skipExisting;
    }

    public void setSkipExisting(boolean skipExisting) {
        this.skipExisting = skipExisting;
    }
}
