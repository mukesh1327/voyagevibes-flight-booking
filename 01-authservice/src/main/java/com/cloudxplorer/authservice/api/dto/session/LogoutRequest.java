package com.cloudxplorer.authservice.api.dto.session;

public record LogoutRequest(
    String refreshToken,
    boolean allSessions
) {
}
