package com.cloudxplorer.authservice.api.dto.publicauth;

public record StepUpVerifyResponse(
    boolean verified,
    String expiresAt
) {
}
