package com.ledger.controller;

import com.ledger.common.ApiResponse;
import com.ledger.dto.StatsResponse;
import com.ledger.service.StatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /**
     * 统计接口：一次返回合计、按名称、按分类、按月/按年数据。
     *
     * @param from        起始月份 yyyy-MM，可不传
     * @param to          结束月份 yyyy-MM，可不传
     * @param granularity month（按月）或 year（按年），默认 month
     */
    @GetMapping("/stats")
    public ApiResponse<StatsResponse> stats(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "month") String granularity) {
        return ApiResponse.ok(statsService.stats(from, to, granularity));
    }
}
