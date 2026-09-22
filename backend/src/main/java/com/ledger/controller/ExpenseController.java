package com.ledger.controller;

import com.ledger.common.ApiResponse;
import com.ledger.dto.BatchFillRequest;
import com.ledger.dto.RecordNode;
import com.ledger.dto.RecordOption;
import com.ledger.dto.RecordRequest;
import com.ledger.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/records")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    /**
     * 树形查询：顶级为「支出名称」，子项可继续嵌套。
     *
     * @param from 起始月份 yyyy-MM（含），可不传
     * @param to   结束月份 yyyy-MM（含），可不传
     */
    @GetMapping("/tree")
    public ApiResponse<List<RecordNode>> tree(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(expenseService.tree(from, to, keyword));
    }

    /** 扁平明细（仅叶子节点，即真实金额行） */
    @GetMapping("/leaves")
    public ApiResponse<List<RecordNode>> leaves(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(expenseService.leaves(from, to, keyword));
    }

    /** 父项下拉：所有节点，带完整路径；传 period 只看该月 */
    @GetMapping("/options")
    public ApiResponse<List<RecordOption>> options(@RequestParam(required = false) String period) {
        return ApiResponse.ok(expenseService.options(period));
    }

    /** 已有的月份列表（倒序），用于月份快捷切换 */
    @GetMapping("/periods")
    public ApiResponse<List<String>> periods() {
        return ApiResponse.ok(expenseService.periods());
    }

    @PostMapping
    public ApiResponse<RecordNode> create(@Valid @RequestBody RecordRequest request) {
        return ApiResponse.ok(expenseService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<RecordNode> update(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return ApiResponse.ok(expenseService.update(id, patch));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable Long id) {
        int deleted = expenseService.delete(id);
        return ApiResponse.ok(Map.of("deleted", deleted));
    }

    /** 按月批量生成：若干子项 × 一段月份 */
    @PostMapping("/batch")
    public ApiResponse<Map<String, Object>> batch(@RequestBody BatchFillRequest request) {
        return ApiResponse.ok(expenseService.batchFill(request));
    }
}
