package com.cloudxplorer.authservice.api.controller;

import com.cloudxplorer.authservice.api.PublicAuthApi;
import com.cloudxplorer.authservice.api.dto.publicauth.*;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import com.cloudxplorer.authservice.application.service.AuthApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
// import org.springframework.web.bind.annotation.RequestHeader;
// import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicAuthController implements PublicAuthApi {

    private final AuthApplicationService service;
    private final CurrentUserResolver currentUserResolver;

    public PublicAuthController(AuthApplicationService service, CurrentUserResolver currentUserResolver) {
        this.service = service;
        this.currentUserResolver = currentUserResolver;
    }

    @Override
    public ResponseEntity<PublicGoogleStartResponse> startGoogleLogin() {
        return ResponseEntity.ok(service.startPublicGoogleLogin());
    }

    @Override
    public ResponseEntity<AuthSessionResponse> googleCallback(String code, String state, String codeVerifier, String device, String ip) {
        return ResponseEntity.ok(service.completePublicGoogleLogin(code, state, codeVerifier, device, ip));
    }

    @Override
    public ResponseEntity<Void> publicLogout(String userId, @Valid @RequestBody LogoutRequest request) {
        service.logout(currentUserResolver.resolveUserId(userId), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<OtpChallengeResponse> requestStepUpOtp(@Valid @RequestBody OtpRequest request) {
        return ResponseEntity.ok(service.requestStepUpOtp(request));
    }

    @Override
    public ResponseEntity<StepUpVerifyResponse> verifyStepUpOtp(@Valid @RequestBody OtpVerifyRequest request) {
        return ResponseEntity.ok(service.verifyStepUpOtp(request));
    }
}
