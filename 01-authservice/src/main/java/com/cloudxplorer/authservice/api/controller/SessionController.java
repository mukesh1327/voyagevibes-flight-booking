package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.SessionApi;
import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import com.cloudxplorer.authservice.api.dto.session.RefreshTokenRequest;
import com.cloudxplorer.authservice.api.dto.session.SessionListResponse;
import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionController implements SessionApi {

    private final AuthApplicationService service;
    private final CurrentUserResolver currentUserResolver;

    public SessionController(AuthApplicationService service, CurrentUserResolver currentUserResolver) {
        this.service = service;
        this.currentUserResolver = currentUserResolver;
    }

    @Override
    public ResponseEntity<AuthSessionResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(service.refresh(request.refreshToken()));
    }

    @Override
    public ResponseEntity<SessionListResponse> getMySessions(String userId) {
        return ResponseEntity.ok(service.getMySessions(currentUserResolver.resolveUserId(userId)));
    }

    @Override
    public ResponseEntity<Void> revokeSession(String userId, String sessionId) {
        service.revokeSession(currentUserResolver.resolveUserId(userId), sessionId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> logout(String userId, @Valid @RequestBody LogoutRequest request) {
        service.logout(currentUserResolver.resolveUserId(userId), request);
        return ResponseEntity.noContent().build();
    }
}
