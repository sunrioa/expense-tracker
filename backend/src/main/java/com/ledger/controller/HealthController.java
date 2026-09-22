package com.ledger.controller;

import com.ledger.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    /** 健康检查，供 docker healthcheck 使用 */
    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("service", "expense-tracker-backend");
        body.put("time", LocalDateTime.now().toString());
        return ApiResponse.ok(body);
    }
}
