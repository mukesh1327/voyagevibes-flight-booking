package com.cloudxplorer.authservice.domain.model;

import java.time.Instant;

public record UserSession(
    String sessionId,
    String userId,
    String device,
    String ip,
    Instant createdAt,
    Instant lastSeenAt,
    String riskLevel
) {
}
