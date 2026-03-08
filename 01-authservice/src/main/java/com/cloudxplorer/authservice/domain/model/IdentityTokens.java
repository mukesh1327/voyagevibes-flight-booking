package com.cloudxplorer.authservice.domain.model;

public record IdentityTokens(
    String accessToken,
    String refreshToken,
    long expiresIn
) {
}
