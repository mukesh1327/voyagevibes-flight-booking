package com.cloudxplorer.authservice.api.dto.health;

import java.util.Map;

public record HealthResponse(
    String status,
    String timestamp,
    String environment,
    Map<String, String> details
) {
}
