package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.corpauth.CorpLoginInitRequest;
import com.cloudxplorer.authservice.api.dto.corpauth.CorpLoginInitResponse;
import com.cloudxplorer.authservice.api.dto.corpauth.CorpLoginVerifyRequest;
import com.cloudxplorer.authservice.api.dto.corpauth.CorpLoginVerifyResponse;
import com.cloudxplorer.authservice.api.dto.corpauth.CorpMfaChallengeRequest;
import com.cloudxplorer.authservice.api.dto.corpauth.CorpMfaVerifyRequest;
import com.cloudxplorer.authservice.api.dto.corpauth.WebAuthnChallengeResponse;
import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.publicauth.OtpChallengeResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@Tag(name = "Corporate Auth", description = "Corporate workforce authentication and MFA endpoints.")
public interface CorpAuthApi {
    @Operation(summary = "Initialize corporate login", description = "Starts a corporate login flow and returns the supported primary factors.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpLoginInitRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_LOGIN_INIT_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Corporate login flow created",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = CorpLoginInitResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_LOGIN_INIT_RESPONSE)
            )
        )
    })
    @PostMapping("/api/v1/auth/corp/login/init")
    ResponseEntity<CorpLoginInitResponse> initCorpLogin(@Valid @RequestBody CorpLoginInitRequest request);

    @Operation(summary = "Verify corporate primary factor", description = "Validates the corporate login assertion and issues a session when MFA is not required.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpLoginVerifyRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_LOGIN_VERIFY_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Corporate login verified",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = CorpLoginVerifyResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_LOGIN_VERIFY_RESPONSE)
            )
        )
    })
    @PostMapping("/api/v1/auth/corp/login/verify")
    ResponseEntity<CorpLoginVerifyResponse> verifyCorpLogin(@Valid @RequestBody CorpLoginVerifyRequest request);

    @Operation(summary = "Create corporate MFA challenge", description = "Creates the follow-up MFA challenge for OTP or passkey-based corporate login flows.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpMfaChallengeRequest.class),
            examples = {
                @ExampleObject(name = "OTP challenge", value = PublicAuthApi.OpenApiExamples.CORP_MFA_CHALLENGE_REQUEST),
                @ExampleObject(name = "Passkey challenge", value = PublicAuthApi.OpenApiExamples.CORP_MFA_CHALLENGE_PASSKEY_REQUEST)
            }
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "MFA challenge generated",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(oneOf = {OtpChallengeResponse.class, WebAuthnChallengeResponse.class}),
                examples = {
                    @ExampleObject(name = "OTP response", value = PublicAuthApi.OpenApiExamples.OTP_CHALLENGE_RESPONSE),
                    @ExampleObject(name = "Passkey response", value = PublicAuthApi.OpenApiExamples.WEBAUTHN_CHALLENGE_RESPONSE)
                }
            )
        )
    })
    @PostMapping("/api/v1/auth/corp/mfa/challenge")
    ResponseEntity<Object> challengeCorpMfa(@Valid @RequestBody CorpMfaChallengeRequest request);

    @Operation(summary = "Verify corporate MFA", description = "Validates the issued MFA challenge and creates the final authenticated session.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = CorpMfaVerifyRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.CORP_MFA_VERIFY_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Corporate MFA verified",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = AuthSessionResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.AUTH_SESSION_RESPONSE)
            )
        )
    })
    @PostMapping("/api/v1/auth/corp/mfa/verify")
    ResponseEntity<AuthSessionResponse> verifyCorpMfa(
        @Valid @RequestBody CorpMfaVerifyRequest request,
        @Parameter(in = ParameterIn.HEADER, description = "Device name captured with the corporate session.", example = "Corp Chrome on Windows")
        @RequestHeader(value = "X-Device", required = false) String device,
        @Parameter(in = ParameterIn.HEADER, description = "Caller IP used for session telemetry.", example = "10.10.20.31")
        @RequestHeader(value = "X-Forwarded-For", required = false) String ip
    );

    @Operation(summary = "Logout corporate user", description = "Logs out a corporate user by revoking the refresh token and optionally revoking all sessions.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = LogoutRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.LOGOUT_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Corporate session revoked")
    })
    @PostMapping("/api/v1/auth/corp/logout")
    ResponseEntity<Void> corpLogout(
        @Parameter(in = ParameterIn.HEADER, description = "Current corporate user identifier.", example = "corp-user-2001")
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody LogoutRequest request
    );
}