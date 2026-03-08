package com.cloudxplorer.authservice.api.dto.session;

public record SessionInfo(
    String sessionId,
    String device,
    String ip,
    String createdAt,
    String lastSeenAt,
    String riskLevel
) {
}
