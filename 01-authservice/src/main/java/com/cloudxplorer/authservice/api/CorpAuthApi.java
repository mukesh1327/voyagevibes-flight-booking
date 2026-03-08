package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.corpauth.*;
import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public interface CorpAuthApi {
    @PostMapping("/api/v1/auth/corp/login/init")
    ResponseEntity<CorpLoginInitResponse> initCorpLogin(@Valid @RequestBody CorpLoginInitRequest request);

    @PostMapping("/api/v1/auth/corp/login/verify")
    ResponseEntity<CorpLoginVerifyResponse> verifyCorpLogin(@Valid @RequestBody CorpLoginVerifyRequest request);

    @PostMapping("/api/v1/auth/corp/mfa/challenge")
    ResponseEntity<Object> challengeCorpMfa(@Valid @RequestBody CorpMfaChallengeRequest request);

    @PostMapping("/api/v1/auth/corp/mfa/verify")
    ResponseEntity<AuthSessionResponse> verifyCorpMfa(
        @Valid @RequestBody CorpMfaVerifyRequest request,
        @RequestHeader(value = "X-Device", required = false) String device,
        @RequestHeader(value = "X-Forwarded-For", required = false) String ip
    );

    @PostMapping("/api/v1/auth/corp/logout")
    ResponseEntity<Void> corpLogout(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody LogoutRequest request
    );
}
