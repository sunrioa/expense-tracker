package com.ledger.service;

import com.ledger.common.BusinessException;
import com.ledger.common.Periods;
import com.ledger.dto.BatchFillRequest;
import com.ledger.dto.RecordNode;
import com.ledger.dto.RecordOption;
import com.ledger.dto.RecordRequest;
import com.ledger.entity.ExpenseRecord;
import com.ledger.repository.ExpenseRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * 记账服务：按月记账 + 自关联树。
 *
 * <p>金额规则：只有叶子节点落库真实金额，父项实时汇总，避免统计时父子重复累加。
 */
@Service
public class ExpenseService {

    /** 根节点在 childrenMap 中的虚拟 key */
    private static final Long ROOT_KEY = 0L;
    /** 单次批量生成最多产生的行数，防止误操作 */
    private static final int BATCH_LIMIT = 5000;
    /** 单次批量生成最多跨多少个月 */
    private static final int BATCH_MONTH_LIMIT = 120;

    private final ExpenseRecordRepository repository;

    public ExpenseService(ExpenseRecordRepository repository) {
        this.repository = repository;
    }

    // ---------------------------------------------------------------- 查询

    /**
     * 树形查询。
     *
     * @param from    起始月份 yyyy-MM（含），null 不限
     * @param to      结束月份 yyyy-MM（含），null 不限
     * @param keyword 名称 / 详细模糊匹配，null 不限
     */
    @Transactional(readOnly = true)
    public List<RecordNode> tree(String from, String to, String keyword) {
        List<ExpenseRecord> all = repository.findAllByOrderByIdAsc();
        return buildForest(all, from, to, keyword);
    }

    /** 扁平列表，只返回叶子节点（真实金额行） */
    @Transactional(readOnly = true)
    public List<RecordNode> leaves(String from, String to, String keyword) {
        List<ExpenseRecord> all = repository.findAllByOrderByIdAsc();
        Map<Long, ExpenseRecord> byId = index(all);
        Set<Long> parentIds = parentIdSet(all);

        List<RecordNode> result = new ArrayList<>();
        for (ExpenseRecord r : all) {
            if (parentIds.contains(r.getId())) {
                continue;
            }
            if (!matches(r, from, to, keyword)) {
                continue;
            }
            result.add(toLeafNode(r, byId));
        }
        result.sort((a, b) -> {
            int c = comparePeriod(a.getPeriod(), b.getPeriod());
            if (c != 0) {
                return -c;
            }
            return Long.compare(nz(b.getId()), nz(a.getId()));
        });
        return result;
    }

    /**
     * 所有节点，用于「添加到哪个条目下」的下拉选择。
     *
     * @param period 只返回该月份的条目；null 表示全部（标签里会带上月份）
     */
    @Transactional(readOnly = true)
    public List<RecordOption> options(String period) {
        List<ExpenseRecord> all = repository.findAllByOrderByIdAsc();
        Map<Long, ExpenseRecord> byId = index(all);
        Set<Long> parentIds = parentIdSet(all);

        List<RecordOption> options = new ArrayList<>();
        for (ExpenseRecord r : all) {
            if (period != null && !period.equals(r.getPeriod())) {
                continue;
            }
            String label = fullPath(r, byId);
            if (period == null) {
                label = "[" + r.getPeriod() + "] " + label;
            }
            options.add(new RecordOption(
                    r.getId(),
                    label,
                    r.getName(),
                    r.getPeriod(),
                    depthOf(r, byId),
                    parentIds.contains(r.getId())));
        }
        options.sort(Comparator.comparing(RecordOption::getLabel));
        return options;
    }

    /** 现有的月份列表，倒序（最新在前） */
    @Transactional(readOnly = true)
    public List<String> periods() {
        Set<String> set = new TreeSet<>(Comparator.reverseOrder());
        for (ExpenseRecord r : repository.findAllByOrderByIdAsc()) {
            if (r.getPeriod() != null && !r.getPeriod().isBlank()) {
                set.add(r.getPeriod());
            }
        }
        return new ArrayList<>(set);
    }

    // ---------------------------------------------------------------- 写入

    @Transactional
    public RecordNode create(RecordRequest request) {
        ExpenseRecord entity = new ExpenseRecord();
        entity.setParentId(request.getParentId());
        entity.setName(request.getName().trim());
        entity.setDetail(trimToNull(request.getDetail()));
        entity.setAmount(request.getAmount() == null ? BigDecimal.ZERO : request.getAmount());
        entity.setPeriod(normalizeOrDefault(request.getPeriod()));

        if (request.getParentId() != null) {
            ExpenseRecord parent = repository.findById(request.getParentId())
                    .orElseThrow(() -> new BusinessException("父项不存在，无法添加子项"));
            // 只允许两级：子项下不能再挂子项
            if (parent.getParentId() != null) {
                throw new BusinessException("「" + parent.getName()
                        + "」已经是子项，子项下不能再添加子项；请把新条目加到顶级条目下");
            }
            // 子项默认跟随父项月份，避免父子跨月对不上
            if (request.getPeriod() == null || request.getPeriod().isBlank()) {
                entity.setPeriod(parent.getPeriod());
            }
        }
        ExpenseRecord saved = repository.save(entity);
        return toLeafNode(saved, index(repository.findAllByOrderByIdAsc()));
    }

    /**
     * 局部更新：只更新请求里出现过的字段，未出现的字段保持原值。
     * （界面上改单元格只提交那一个字段，不能把其它字段清空）
     */
    @Transactional
    public RecordNode update(Long id, Map<String, Object> patch) {
        ExpenseRecord entity = repository.findById(id)
                .orElseThrow(() -> new BusinessException("记录不存在：" + id));

        if (patch.containsKey("parentId")) {
            Object v = patch.get("parentId");
            if (v == null || String.valueOf(v).isBlank()) {
                entity.setParentId(null);
            } else {
                Long pid = toLong(v);
                if (pid.equals(id)) {
                    throw new BusinessException("不能把自己设为自己的父项");
                }
                if (isDescendant(id, pid)) {
                    throw new BusinessException("不能把子项设为自己的父项（会形成环）");
                }
                if (!repository.existsById(pid)) {
                    throw new BusinessException("父项不存在：" + pid);
                }
                ExpenseRecord target = repository.findById(pid)
                        .orElseThrow(() -> new BusinessException("父项不存在：" + pid));
                // 只允许两级：子项下不能再挂子项
                if (target.getParentId() != null) {
                    throw new BusinessException("「" + target.getName()
                            + "」已经是子项，子项下不能再添加子项；请挂到顶级条目下");
                }
                entity.setParentId(pid);
            }
        }
        if (patch.containsKey("name")) {
            String name = toStr(patch.get("name"));
            if (name == null) {
                throw new BusinessException("支出名称不能为空");
            }
            if (name.length() > 64) {
                throw new BusinessException("支出名称最长 64 个字符");
            }
            entity.setName(name);
        }
        if (patch.containsKey("detail")) {
            entity.setDetail(clip(toStr(patch.get("detail")), 255));
        }
        if (patch.containsKey("amount")) {
            Object v = patch.get("amount");
            if (v == null || String.valueOf(v).isBlank()) {
                entity.setAmount(BigDecimal.ZERO);
            } else {
                BigDecimal amount;
                try {
                    amount = new BigDecimal(String.valueOf(v).trim());
                } catch (NumberFormatException e) {
                    throw new BusinessException("支出金额格式不正确：" + v);
                }
                if (amount.signum() < 0) {
                    throw new BusinessException("支出金额不能为负数");
                }
                entity.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
            }
        }
        // 改月份时把子孙一起带过去，保证父子同月（否则按月筛选后父子会分散在不同月份）
        String cascadePeriod = null;
        if (patch.containsKey("period")) {
            String p = Periods.normalize(toStr(patch.get("period")));
            if (p != null && !p.equals(entity.getPeriod())) {
                entity.setPeriod(p);
                cascadePeriod = p;
            }
        }

        ExpenseRecord saved = repository.save(entity);

        if (cascadePeriod != null) {
            List<Long> descendantIds = collectWithDescendants(id);
            descendantIds.remove(id);
            if (!descendantIds.isEmpty()) {
                List<ExpenseRecord> descendants = repository.findAllById(descendantIds);
                for (ExpenseRecord d : descendants) {
                    d.setPeriod(cascadePeriod);
                }
                repository.saveAll(descendants);
            }
        }

        return toLeafNode(saved, index(repository.findAllByOrderByIdAsc()));
    }

    /** 删除节点及其所有子孙节点 */
    @Transactional
    public int delete(Long id) {
        if (!repository.existsById(id)) {
            throw new BusinessException("记录不存在：" + id);
        }
        List<Long> ids = collectWithDescendants(id);
        repository.deleteAllById(ids);
        return ids.size();
    }

    /**
     * 按月批量生成：把 items × 月份区间 铺成多行记录。
     *
     * <p>例：父项「房租」，子项 3200，月份 2026-01 ~ 2026-12 → 生成 12 行，每个月一条。
     * 每个月都会复用（或新建）该月自己的父项，保证父子同月。
     */
    @Transactional
    public Map<String, Object> batchFill(BatchFillRequest request) {
        String from = Periods.normalize(request.getFromPeriod());
        String to = Periods.normalize(request.getToPeriod());
        if (from == null || to == null) {
            throw new BusinessException("请选择起始月份和结束月份");
        }
        if (to.compareTo(from) < 0) {
            throw new BusinessException("结束月份不能早于起始月份");
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException("请至少填写一个子项");
        }

        List<String> months = Periods.range(from, to);
        if (months.isEmpty()) {
            throw new BusinessException("月份区间不合法");
        }
        if (months.size() > BATCH_MONTH_LIMIT) {
            throw new BusinessException("月份区间过长（超过 " + BATCH_MONTH_LIMIT + " 个月），请缩小范围");
        }

        String parentNameRaw = request.getParentName() == null ? null : request.getParentName().trim();
        // 必须 effectively final：下面会在 lambda 里用到
        final String parentName = (parentNameRaw == null || parentNameRaw.isEmpty()) ? null : parentNameRaw;

        long planned = (long) months.size() * request.getItems().size();
        if (planned > BATCH_LIMIT) {
            throw new BusinessException("本次将生成 " + planned + " 行，超过 " + BATCH_LIMIT
                    + " 行上限，请缩小月份范围或减少子项");
        }

        // 内存索引：现有全部记录，按 (period + name + parentId) 判断重复
        List<ExpenseRecord> existingAll = repository.findAllByOrderByIdAsc();
        Map<Long, ExpenseRecord> byId = index(existingAll);
        Map<String, ExpenseRecord> dedup = new HashMap<>();
        for (ExpenseRecord r : existingAll) {
            dedup.put(dedupKey(r.getParentId(), r.getName(), r.getPeriod()), r);
        }

        String template = request.getDetailTemplate();
        List<ExpenseRecord> batch = new ArrayList<>();
        int skipped = 0;
        int parentCreated = 0;

        for (String month : months) {
            // 1. 该月的父项
            ExpenseRecord parent = null;
            if (parentName != null) {
                Optional<ExpenseRecord> found = existingAll.stream()
                        .filter(r -> month.equals(r.getPeriod()))
                        .filter(r -> r.getParentId() == null)
                        .filter(r -> parentName.equalsIgnoreCase(r.getName()))
                        .findFirst();
                if (found.isPresent()) {
                    parent = found.get();
                } else {
                    if (!request.isCreateParentIfMissing()) {
                        throw new BusinessException("月份 " + month + " 下不存在父项「" + parentName + "」");
                    }
                    ExpenseRecord np = new ExpenseRecord();
                    np.setParentId(null);
                    np.setName(parentName);
                    np.setAmount(BigDecimal.ZERO);
                    np.setPeriod(month);
                    np.setDetail("月度汇总");
                    parent = repository.save(np);
                    parentCreated++;
                    existingAll.add(parent);
                    byId.put(parent.getId(), parent);
                }
            }

            Long parentId = parent == null ? null : parent.getId();

            // 2. 该月的子项
            for (BatchFillRequest.BatchItem item : request.getItems()) {
                if (item.getName() == null || item.getName().isBlank()) {
                    continue;
                }
                String itemName = item.getName().trim();
                String key = dedupKey(parentId, itemName, month);
                if (request.isSkipExisting() && dedup.containsKey(key)) {
                    skipped++;
                    continue;
                }
                ExpenseRecord r = new ExpenseRecord();
                r.setParentId(parentId);
                r.setName(itemName);
                r.setAmount(item.getAmount() == null ? BigDecimal.ZERO : item.getAmount());
                r.setPeriod(month);
                r.setDetail(renderDetail(template, item.getDetail(), month, itemName, parentName));
                batch.add(r);
                dedup.put(key, r);
            }
        }

        if (!batch.isEmpty()) {
            repository.saveAll(batch);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("created", batch.size());
        result.put("skipped", skipped);
        result.put("parentCreated", parentCreated);
        result.put("parentName", parentName);
        result.put("months", months.size());
        result.put("totalAmount", batch.stream()
                .map(ExpenseRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        return result;
    }

    /** 供其它 service 复用 */
    @Transactional(readOnly = true)
    public List<ExpenseRecord> findAll() {
        return repository.findAllByOrderByIdAsc();
    }

    // ---------------------------------------------------------------- 内部工具

    private Map<Long, ExpenseRecord> index(List<ExpenseRecord> all) {
        return all.stream().collect(Collectors.toMap(ExpenseRecord::getId, r -> r, (a, b) -> a));
    }

    private Set<Long> parentIdSet(List<ExpenseRecord> all) {
        return all.stream()
                .map(ExpenseRecord::getParentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private List<RecordNode> buildForest(List<ExpenseRecord> all, String from, String to, String keyword) {
        Map<Long, List<ExpenseRecord>> childMap = new HashMap<>();
        for (ExpenseRecord r : all) {
            Long key = r.getParentId() == null ? ROOT_KEY : r.getParentId();
            childMap.computeIfAbsent(key, k -> new ArrayList<>()).add(r);
        }
        List<RecordNode> roots = new ArrayList<>();
        for (ExpenseRecord r : childMap.getOrDefault(ROOT_KEY, List.of())) {
            RecordNode node = buildNode(r, childMap, from, to, keyword, 0, null);
            if (node != null) {
                roots.add(node);
            }
        }
        roots.sort((a, b) -> {
            int c = comparePeriod(a.getPeriod(), b.getPeriod());
            if (c != 0) {
                return c;
            }
            return Long.compare(nz(a.getId()), nz(b.getId()));
        });
        return roots;
    }

    private RecordNode buildNode(ExpenseRecord r, Map<Long, List<ExpenseRecord>> childMap,
                                 String from, String to, String keyword,
                                 int depth, String parentPath) {
        String path = parentPath == null ? r.getName() : parentPath + " / " + r.getName();

        List<RecordNode> children = new ArrayList<>();
        for (ExpenseRecord c : childMap.getOrDefault(r.getId(), List.of())) {
            RecordNode child = buildNode(c, childMap, from, to, keyword, depth + 1, path);
            if (child != null) {
                children.add(child);
            }
        }

        boolean selfMatch = matches(r, from, to, keyword);
        // 自己不符合条件、也没有符合条件的孩子 → 整棵子树不展示
        if (children.isEmpty() && !selfMatch) {
            return null;
        }

        children.sort((a, b) -> {
            int c = comparePeriod(a.getPeriod(), b.getPeriod());
            if (c != 0) {
                return c;
            }
            return Long.compare(nz(a.getId()), nz(b.getId()));
        });

        RecordNode node = new RecordNode();
        node.setId(r.getId());
        node.setParentId(r.getParentId());
        node.setName(r.getName());
        node.setDetail(r.getDetail());
        node.setAmount(r.getAmount());
        node.setPeriod(r.getPeriod());
        node.setSortOrder(r.getSortOrder());
        node.setDepth(depth);
        node.setPath(path);
        node.setChildren(children);
        node.setHasChildren(!children.isEmpty());

        if (children.isEmpty()) {
            node.setSubtotal(r.getAmount() == null ? BigDecimal.ZERO : r.getAmount());
            node.setAmountEditable(true);
        } else {
            // 有子项 → 金额由子项自动汇总
            BigDecimal sum = children.stream()
                    .map(c -> c.getSubtotal() == null ? BigDecimal.ZERO : c.getSubtotal())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            node.setSubtotal(sum);
            node.setAmountEditable(false);
        }
        return node;
    }

    private RecordNode toLeafNode(ExpenseRecord r, Map<Long, ExpenseRecord> byId) {
        RecordNode node = new RecordNode();
        node.setId(r.getId());
        node.setParentId(r.getParentId());
        node.setName(r.getName());
        node.setDetail(r.getDetail());
        node.setAmount(r.getAmount());
        node.setSubtotal(r.getAmount() == null ? BigDecimal.ZERO : r.getAmount());
        node.setPeriod(r.getPeriod());
        node.setSortOrder(r.getSortOrder());
        node.setHasChildren(false);
        node.setAmountEditable(true);
        node.setDepth(depthOf(r, byId));
        node.setPath(fullPath(r, byId));
        return node;
    }

    private boolean matches(ExpenseRecord r, String from, String to, String keyword) {
        if ((from != null || to != null) && !Periods.inRange(r.getPeriod(), from, to)) {
            return false;
        }
        if (keyword != null && !keyword.isBlank()) {
            String k = keyword.trim().toLowerCase();
            String name = r.getName() == null ? "" : r.getName().toLowerCase();
            String detail = r.getDetail() == null ? "" : r.getDetail().toLowerCase();
            return name.contains(k) || detail.contains(k);
        }
        return true;
    }

    private List<Long> collectWithDescendants(Long rootId) {
        List<ExpenseRecord> all = repository.findAllByOrderByIdAsc();
        Map<Long, List<Long>> childMap = new HashMap<>();
        for (ExpenseRecord r : all) {
            if (r.getParentId() != null) {
                childMap.computeIfAbsent(r.getParentId(), k -> new ArrayList<>()).add(r.getId());
            }
        }
        List<Long> result = new ArrayList<>();
        Deque<Long> stack = new ArrayDeque<>();
        stack.push(rootId);
        while (!stack.isEmpty()) {
            Long cur = stack.pop();
            result.add(cur);
            for (Long child : childMap.getOrDefault(cur, List.of())) {
                stack.push(child);
            }
        }
        return result;
    }

    private boolean isDescendant(Long ancestorId, Long candidateId) {
        return collectWithDescendants(ancestorId).contains(candidateId);
    }

    private String fullPath(ExpenseRecord r, Map<Long, ExpenseRecord> byId) {
        List<String> parts = new ArrayList<>();
        ExpenseRecord cur = r;
        int guard = 0;
        while (cur != null && guard++ < 50) {
            parts.add(0, cur.getName());
            cur = cur.getParentId() == null ? null : byId.get(cur.getParentId());
        }
        return String.join(" / ", parts);
    }

    private int depthOf(ExpenseRecord r, Map<Long, ExpenseRecord> byId) {
        int d = 0;
        ExpenseRecord cur = r;
        int guard = 0;
        while (cur != null && cur.getParentId() != null && guard++ < 50) {
            cur = byId.get(cur.getParentId());
            d++;
        }
        return d;
    }

    private static String normalizeOrDefault(String raw) {
        String p = Periods.normalize(raw);
        return p == null ? Periods.current() : p;
    }

    private static int comparePeriod(String a, String b) {
        if (a == null && b == null) {
            return 0;
        }
        if (a == null) {
            return -1;
        }
        if (b == null) {
            return 1;
        }
        return a.compareTo(b);
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String clip(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String toStr(Object v) {
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static Long toLong(Object v) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new BusinessException("非法的 ID：" + v);
        }
    }

    private static String dedupKey(Long parentId, String name, String period) {
        return (parentId == null ? "root" : parentId) + "|"
                + (name == null ? "" : name.toLowerCase()) + "|" + period;
    }

    private static String renderDetail(String template, String fallback, String period,
                                       String name, String parentName) {
        if (template == null || template.isBlank()) {
            return trimToNull(fallback);
        }
        String month = period != null && period.length() == 7 ? period.substring(5) : period;
        String out = template
                .replace("{period}", period == null ? "" : period)
                .replace("{month}", month == null ? "" : month)
                .replace("{name}", name == null ? "" : name)
                .replace("{parent}", parentName == null ? "" : parentName);
        return trimToNull(clip(out, 255));
    }

    /** 暴露给 StatsService 的月份集合 */
    @Transactional(readOnly = true)
    public Set<String> distinctPeriods() {
        Set<String> set = new HashSet<>();
        for (ExpenseRecord r : repository.findAllByOrderByIdAsc()) {
            if (r.getPeriod() != null && !r.getPeriod().isBlank()) {
                set.add(r.getPeriod());
            }
        }
        return set;
    }
}
