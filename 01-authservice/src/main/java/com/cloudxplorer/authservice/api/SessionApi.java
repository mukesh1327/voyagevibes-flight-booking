package com.cloudxplorer.authservice.api;

import com.cloudxplorer.authservice.api.dto.publicauth.AuthSessionResponse;
import com.cloudxplorer.authservice.api.dto.session.LogoutRequest;
import com.cloudxplorer.authservice.api.dto.session.RefreshTokenRequest;
import com.cloudxplorer.authservice.api.dto.session.SessionListResponse;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@Tag(name = "Sessions", description = "Refresh, logout, and session management endpoints.")
public interface SessionApi {
    @Operation(summary = "Refresh tokens", description = "Uses a refresh token to obtain a new auth session response.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = RefreshTokenRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.REFRESH_TOKEN_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Tokens refreshed",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = AuthSessionResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.AUTH_SESSION_RESPONSE)
            )
        )
    })
    @PostMapping("/api/v1/auth/token/refresh")
    ResponseEntity<AuthSessionResponse> refresh(@Valid @RequestBody RefreshTokenRequest request);

    @Operation(summary = "List current user sessions", description = "Returns active sessions/devices for the resolved user.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Sessions returned",
            content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = SessionListResponse.class),
                examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.SESSION_LIST_RESPONSE)
            )
        )
    })
    @GetMapping("/api/v1/sessions/me")
    ResponseEntity<SessionListResponse> getMySessions(
        @Parameter(in = ParameterIn.HEADER, description = "Current user identifier used to resolve sessions.", example = "user-public-1001")
        @RequestHeader(value = "X-User-Id", required = false) String userId
    );

    @Operation(summary = "Revoke a single session", description = "Revokes one active session for the resolved user.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Session revoked")
    })
    @DeleteMapping("/api/v1/sessions/me/{sessionId}")
    ResponseEntity<Void> revokeSession(
        @Parameter(in = ParameterIn.HEADER, description = "Current user identifier used to authorize the revoke.", example = "user-public-1001")
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Parameter(in = ParameterIn.PATH, description = "Session identifier to revoke.", example = "sess-1001")
        @PathVariable("sessionId") String sessionId
    );

    @Operation(summary = "Shared logout", description = "Shared logout endpoint that revokes refresh tokens and optionally revokes all sessions.")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        required = true,
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = LogoutRequest.class),
            examples = @ExampleObject(value = PublicAuthApi.OpenApiExamples.LOGOUT_REQUEST)
        )
    )
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "User logged out")
    })
    @PostMapping("/api/v1/auth/logout")
    ResponseEntity<Void> logout(
        @Parameter(in = ParameterIn.HEADER, description = "Current user identifier.", example = "user-public-1001")
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody LogoutRequest request
    );
}