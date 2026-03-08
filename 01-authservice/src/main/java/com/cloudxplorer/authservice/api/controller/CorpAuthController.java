package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.CorpAuthApi;
import com.cloudxplorer.authservice.api.dto.corpauth.*;
import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CorpAuthController implements CorpAuthApi {

    private final AuthApplicationService service;
    private final CurrentUserResolver currentUserResolver;

    public CorpAuthController(AuthApplicationService service, CurrentUserResolver currentUserResolver) {
        this.service = service;
        this.currentUserResolver = currentUserResolver;
    }

    @Override
    public ResponseEntity<CorpLoginInitResponse> initCorpLogin(@Valid @RequestBody CorpLoginInitRequest request) {
        return ResponseEntity.ok(service.initCorpLogin(request));
    }

    @Override
    public ResponseEntity<CorpLoginVerifyResponse> verifyCorpLogin(@Valid @RequestBody CorpLoginVerifyRequest request) {
        return ResponseEntity.ok(service.verifyCorpLogin(request));
    }

    @Override
    public ResponseEntity<Object> challengeCorpMfa(@Valid @RequestBody CorpMfaChallengeRequest request) {
        return ResponseEntity.ok(service.challengeCorpMfa(request));
    }

    @Override
    public ResponseEntity<AuthSessionResponse> verifyCorpMfa(@Valid @RequestBody CorpMfaVerifyRequest request, String device, String ip) {
        return ResponseEntity.ok(service.verifyCorpMfa(request, device, ip));
    }

    @Override
    public ResponseEntity<Void> corpLogout(String userId, @Valid @RequestBody LogoutRequest request) {
        service.logout(currentUserResolver.resolveUserId(userId), request);
        return ResponseEntity.noContent().build();
    }
}
