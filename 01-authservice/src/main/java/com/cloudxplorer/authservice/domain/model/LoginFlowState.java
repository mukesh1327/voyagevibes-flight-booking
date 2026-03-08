package com.cloudxplorer.authservice.domain.model;

import java.time.Instant;

public record LoginFlowState(
    String state,
    String codeVerifier,
    Instant expiresAt
) {
}
