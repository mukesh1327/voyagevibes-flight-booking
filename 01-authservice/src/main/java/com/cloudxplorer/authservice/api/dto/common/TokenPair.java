package com.cloudxplorer.authservice.api.dto.common;

public record TokenPair(
    String accessToken,
    String refreshToken,
    long expiresIn
) {
}
