package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.publicauth.*;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public interface PublicAuthApi {
    @GetMapping("/api/v1/auth/public/google/start")
    ResponseEntity<PublicGoogleStartResponse> startGoogleLogin();

    @GetMapping("/api/v1/auth/public/google/callback")
    ResponseEntity<AuthSessionResponse> googleCallback(
        @RequestParam("code") String code,
        @RequestParam("state") String state,
        @RequestHeader(value = "X-Code-Verifier", required = false) String codeVerifier,
        @RequestHeader(value = "X-Device", required = false) String device,
        @RequestHeader(value = "X-Forwarded-For", required = false) String ip
    );

    @PostMapping("/api/v1/auth/public/logout")
    ResponseEntity<Void> publicLogout(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody LogoutRequest request
    );

    @PostMapping("/api/v1/auth/public/step-up/otp/request")
    ResponseEntity<OtpChallengeResponse> requestStepUpOtp(@Valid @RequestBody OtpRequest request);

    @PostMapping("/api/v1/auth/public/step-up/otp/verify")
    ResponseEntity<StepUpVerifyResponse> verifyStepUpOtp(@Valid @RequestBody OtpVerifyRequest request);
}
