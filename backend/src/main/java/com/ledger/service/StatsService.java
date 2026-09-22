package com.ledger.service;

import com.ledger.common.Periods;
import com.ledger.dto.StatsResponse;
import com.ledger.entity.ExpenseRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * 统计服务：按月趋势 / 按年汇总 / 按支出名称 / 按顶级分类。
 *
 * <p>只统计「叶子节点」，父项属于分组容器，不参与累加，避免父子重复计算。
 */
@Service
public class StatsService {

    /** 饼图 / 排行配色：靛蓝打头，紫、青、翠、琥珀、玫红依次铺开，保证相邻色差明显 */
    private static final String[] PALETTE = {
            "#4f46e5", "#0891b2", "#7c3aed", "#059669", "#d97706",
            "#e11d48", "#2563eb", "#db2777", "#0d9488", "#ea580c",
            "#65a30d", "#9333ea", "#0284c7", "#c026d3", "#b45309"
    };

    private final ExpenseService expenseService;

    public StatsService(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    /**
     * @param fromPeriod  起始月份 yyyy-MM，null 表示不限
     * @param toPeriod    结束月份 yyyy-MM，null 表示不限
     * @param granularity month（按月）或 year（按年），默认 month
     */
    @Transactional(readOnly = true)
    public StatsResponse stats(String fromPeriod, String toPeriod, String granularity) {
        String gran = "year".equalsIgnoreCase(granularity) ? "year" : "month";
        String from = Periods.normalize(fromPeriod);
        String to = Periods.normalize(toPeriod);

        List<ExpenseRecord> all = expenseService.findAll();
        Map<Long, ExpenseRecord> byId = all.stream()
                .collect(Collectors.toMap(ExpenseRecord::getId, r -> r, (a, b) -> a));
        Set<Long> parentIds = all.stream()
                .map(ExpenseRecord::getParentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<ExpenseRecord> leaves = all.stream()
                .filter(r -> !parentIds.contains(r.getId()))
                .filter(r -> (from == null && to == null) || Periods.inRange(r.getPeriod(), from, to))
                .collect(Collectors.toList());

        StatsResponse resp = new StatsResponse();
        resp.setGranularity(gran);
        resp.setFromPeriod(from);
        resp.setToPeriod(to);

        if (leaves.isEmpty()) {
            resp.setByPeriod(new ArrayList<>());
            return resp;
        }

        // ---- 总计 ----
        BigDecimal total = leaves.stream()
                .map(ExpenseRecord::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        resp.setTotal(total);
        resp.setRecordCount(leaves.size());

        TreeSet<String> months = new TreeSet<>();
        for (ExpenseRecord r : leaves) {
            if (r.getPeriod() != null) {
                months.add(r.getPeriod());
            }
        }
        resp.setMonthCount(months.size());
        resp.setAvgPerMonth(months.isEmpty() ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(months.size()), 2, RoundingMode.HALF_UP));

        ExpenseRecord maxRec = leaves.stream()
                .filter(r -> r.getAmount() != null)
                .max(Comparator.comparing(ExpenseRecord::getAmount))
                .orElse(null);
        if (maxRec != null) {
            resp.setMaxAmount(maxRec.getAmount());
            resp.setMaxAmountName(maxRec.getName());
            resp.setMaxAmountPeriod(maxRec.getPeriod());
        }

        // 未指定区间时，用数据自身范围回填
        String effectiveFrom = from == null ? (months.isEmpty() ? null : months.first()) : from;
        String effectiveTo = to == null ? (months.isEmpty() ? null : months.last()) : to;
        resp.setFromPeriod(effectiveFrom);
        resp.setToPeriod(effectiveTo);

        // ---- 按支出名称（叶子名称，如 单车 / 地铁 / 吃） ----
        Map<String, BigDecimal> nameTotal = new LinkedHashMap<>();
        Map<String, Long> nameCount = new LinkedHashMap<>();
        for (ExpenseRecord r : leaves) {
            String n = r.getName() == null ? "未命名" : r.getName();
            nameTotal.merge(n, nz(r.getAmount()), BigDecimal::add);
            nameCount.merge(n, 1L, Long::sum);
        }
        resp.setByName(toNameStats(nameTotal, nameCount, total));

        // ---- 按顶级分类（如 交通 / 吃） ----
        Map<String, BigDecimal> catTotal = new LinkedHashMap<>();
        Map<String, Long> catCount = new LinkedHashMap<>();
        for (ExpenseRecord r : leaves) {
            String c = categoryOf(r, byId);
            catTotal.merge(c, nz(r.getAmount()), BigDecimal::add);
            catCount.merge(c, 1L, Long::sum);
        }
        resp.setByCategory(toNameStats(catTotal, catCount, total));

        // ---- 按月 / 按年 ----
        resp.setByPeriod(buildPeriods(leaves, effectiveFrom, effectiveTo, gran, total));
        return resp;
    }

    // ---------------------------------------------------------------- 内部

    private List<StatsResponse.PeriodStat> buildPeriods(List<ExpenseRecord> leaves,
                                                        String from, String to,
                                                        String gran, BigDecimal grandTotal) {
        Map<String, StatsResponse.PeriodStat> buckets = new HashMap<>();
        List<String> order = new ArrayList<>();

        // 先铺满整个区间（含没有数据的月份），让图表连续
        if (from != null && to != null) {
            if ("year".equals(gran)) {
                int fy = yearOf(from);
                int ty = yearOf(to);
                for (int y = fy; y <= ty; y++) {
                    String k = String.valueOf(y);
                    if (buckets.putIfAbsent(k, newPeriod(k, y + "年")) == null) {
                        order.add(k);
                    }
                }
            } else {
                for (String m : Periods.range(from, to)) {
                    if (buckets.putIfAbsent(m, newPeriod(m, Periods.label(m))) == null) {
                        order.add(m);
                    }
                }
            }
        }

        for (ExpenseRecord r : leaves) {
            String p = r.getPeriod();
            if (p == null || p.isBlank()) {
                continue;
            }
            String k = "year".equals(gran) ? String.valueOf(yearOf(p)) : p;
            StatsResponse.PeriodStat ps = buckets.get(k);
            if (ps == null) {
                ps = newPeriod(k, "year".equals(gran) ? k + "年" : Periods.label(k));
                buckets.put(k, ps);
                order.add(k);
            }
            ps.setTotal(ps.getTotal().add(nz(r.getAmount())));
            ps.setCount(ps.getCount() + 1);
        }

        List<StatsResponse.PeriodStat> list = order.stream()
                .map(buckets::get)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(StatsResponse.PeriodStat::getKey))
                .collect(Collectors.toList());

        BigDecimal grand = grandTotal == null || grandTotal.signum() == 0
                ? list.stream().map(StatsResponse.PeriodStat::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                : grandTotal;
        for (StatsResponse.PeriodStat ps : list) {
            ps.setPercent(percent(ps.getTotal(), grand));
        }
        return list;
    }

    private StatsResponse.PeriodStat newPeriod(String key, String label) {
        StatsResponse.PeriodStat ps = new StatsResponse.PeriodStat();
        ps.setKey(key);
        ps.setLabel(label);
        ps.setTotal(BigDecimal.ZERO);
        ps.setCount(0);
        return ps;
    }

    private static int yearOf(String period) {
        try {
            return YearMonth.parse(period).getYear();
        } catch (Exception e) {
            return 0;
        }
    }

    private List<StatsResponse.NameStat> toNameStats(Map<String, BigDecimal> totals,
                                                     Map<String, Long> counts,
                                                     BigDecimal grand) {
        List<StatsResponse.NameStat> list = totals.entrySet().stream()
                .map(e -> new StatsResponse.NameStat(
                        e.getKey(),
                        e.getValue(),
                        counts.getOrDefault(e.getKey(), 0L),
                        percent(e.getValue(), grand)))
                .sorted(Comparator.comparing(StatsResponse.NameStat::getTotal).reversed())
                .collect(Collectors.toList());
        for (int i = 0; i < list.size(); i++) {
            list.get(i).setColor(PALETTE[i % PALETTE.length]);
        }
        return list;
    }

    private String categoryOf(ExpenseRecord r, Map<Long, ExpenseRecord> byId) {
        ExpenseRecord cur = r;
        int guard = 0;
        while (cur != null && cur.getParentId() != null && guard++ < 50) {
            ExpenseRecord p = byId.get(cur.getParentId());
            if (p == null) {
                break;
            }
            cur = p;
        }
        return cur == null || cur.getName() == null ? "未分类" : cur.getName();
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static double percent(BigDecimal part, BigDecimal grand) {
        if (grand == null || grand.signum() == 0) {
            return 0d;
        }
        return part.multiply(BigDecimal.valueOf(100))
                .divide(grand, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
