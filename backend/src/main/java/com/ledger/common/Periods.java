package com.ledger.common;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 月份（yyyy-MM）工具。
 *
 * <p>统一在这里做格式归一化，避免各处重复解析：<br>
 * 接受 2026-9 / 2026/09 / 202609 等写法，一律归一为 2026-09。
 */
public final class Periods {

    private static final Pattern RAW = Pattern.compile("^(\\d{4})[-/.]?(\\d{1,2})$");

    private static final DateTimeFormatter LABEL_CN = DateTimeFormatter.ofPattern("yyyy年MM月");

    private Periods() {
    }

    /** 归一化为 yyyy-MM；空白返回 null；非法抛 BusinessException */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim().replace("年", "-").replace("月", "");
        Matcher m = RAW.matcher(t);
        if (!m.matches()) {
            throw new BusinessException("月份格式不正确，应为 yyyy-MM：" + raw);
        }
        int year = Integer.parseInt(m.group(1));
        int month = Integer.parseInt(m.group(2));
        if (month < 1 || month > 12) {
            throw new BusinessException("月份不合法：" + raw);
        }
        return String.format("%04d-%02d", year, month);
    }

    /** 当前月份 */
    public static String current() {
        return YearMonth.now().toString();
    }

    /** 2026-09 → 2026年09月 */
    public static String label(String period) {
        if (period == null || period.isBlank()) {
            return "未知月份";
        }
        try {
            return YearMonth.parse(period).format(LABEL_CN);
        } catch (Exception e) {
            return period;
        }
    }

    /** 区间内连续月份列表（含两端） */
    public static List<String> range(String from, String to) {
        List<String> list = new ArrayList<>();
        if (from == null || to == null) {
            return list;
        }
        YearMonth cursor = YearMonth.parse(from);
        YearMonth last = YearMonth.parse(to);
        while (!cursor.isAfter(last)) {
            list.add(cursor.toString());
            cursor = cursor.plusMonths(1);
        }
        return list;
    }

    /** in 是否落在 [from, to] 内（字符串比较对 yyyy-MM 有效） */
    public static boolean inRange(String in, String from, String to) {
        if (in == null || in.isBlank()) {
            return false;
        }
        if (from != null && in.compareTo(from) < 0) {
            return false;
        }
        return to == null || in.compareTo(to) <= 0;
    }
}
