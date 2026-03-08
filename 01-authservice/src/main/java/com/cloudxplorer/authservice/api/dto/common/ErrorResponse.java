package com.cloudxplorer.authservice.api.dto.common;

import java.util.Map;

public record ErrorResponse(
    String code,
    String message,
    String traceId,
    Map<String, Object> details
) {
}
