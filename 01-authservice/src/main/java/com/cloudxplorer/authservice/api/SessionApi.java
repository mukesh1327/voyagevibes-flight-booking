package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import com.cloudxplorer.authservice.api.dto.session.RefreshTokenRequest;
import com.cloudxplorer.authservice.api.dto.session.SessionListResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public interface SessionApi {
    @PostMapping("/api/v1/auth/token/refresh")
    ResponseEntity<AuthSessionResponse> refresh(@Valid @RequestBody RefreshTokenRequest request);

    @GetMapping("/api/v1/sessions/me")
    ResponseEntity<SessionListResponse> getMySessions(@RequestHeader(value = "X-User-Id", required = false) String userId);

    @DeleteMapping("/api/v1/sessions/me/{sessionId}")
    ResponseEntity<Void> revokeSession(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @PathVariable("sessionId") String sessionId
    );

    @PostMapping("/api/v1/auth/logout")
    ResponseEntity<Void> logout(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody LogoutRequest request
    );
}
