package com.cloudxplorer.authservice.application.service;

import com.cloudxplorer.authservice.api.dto.common.TokenPair;
import com.cloudxplorer.authservice.api.dto.common.UserSummary;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserCreateRequest;
import com.cloudxplorer.authservice.api.dto.corpadmin.CorpUserUpdateRequest;
import com.cloudxplorer.authservice.api.dto.corpauth.*;
import com.cloudxplorer.authservice.api.dto.publicauth.*;
import com.cloudxplorer.authservice.api.dto.session.*;
import com.cloudxplorer.authservice.api.dto.user.MeResponse;
import com.cloudxplorer.authservice.api.dto.user.UpdateMeRequest;
import com.cloudxplorer.authservice.domain.model.*;
import com.cloudxplorer.authservice.domain.port.IdentityProviderPort;
import com.cloudxplorer.authservice.domain.port.LoginFlowStatePort;
import com.cloudxplorer.authservice.domain.port.SessionPort;
import com.cloudxplorer.authservice.domain.port.UserProfilePort;
import com.cloudxplorer.authservice.exception.BadRequestException;
import com.cloudxplorer.authservice.exception.ConfigurationException;
import com.cloudxplorer.authservice.exception.NotFoundException;
import com.cloudxplorer.authservice.infrastructure.config.AuthServiceProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthApplicationService {

    private static final long FLOW_EXPIRY_SECONDS = 300;

    private final AuthServiceProperties properties;
    private final IdentityProviderPort identityProviderPort;
    private final LoginFlowStatePort loginFlowStatePort;
    private final UserProfilePort userProfilePort;
    private final SessionPort sessionPort;

    public AuthApplicationService(
        AuthServiceProperties properties,
        IdentityProviderPort identityProviderPort,
        LoginFlowStatePort loginFlowStatePort,
        UserProfilePort userProfilePort,
        SessionPort sessionPort
    ) {
        this.properties = properties;
        this.identityProviderPort = identityProviderPort;
        this.loginFlowStatePort = loginFlowStatePort;
        this.userProfilePort = userProfilePort;
        this.sessionPort = sessionPort;
    }

    public PublicGoogleStartResponse startPublicGoogleLogin() {
        String state = UUID.randomUUID().toString();
        String codeVerifier = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        String codeChallenge = sha256Base64Url(codeVerifier);

        loginFlowStatePort.save(new LoginFlowState(state, codeVerifier, Instant.now().plusSeconds(FLOW_EXPIRY_SECONDS)));

        String authorizationUrl = UriComponentsBuilder
            .fromUriString(resolveKeycloakPublicBaseUrl())
            .pathSegment("realms", properties.publicClient().realm(), "protocol", "openid-connect", "auth")
            .queryParam("client_id", properties.publicClient().clientId())
            .queryParam("redirect_uri", properties.publicClient().redirectUri())
            .queryParam("response_type", "code")
            .queryParam("scope", "openid email profile")
            .queryParam("prompt", "select_account")
            .queryParam("state", state)
            .queryParam("code_challenge", codeChallenge)
            .queryParam("code_challenge_method", "S256")
            .queryParam("kc_idp_hint", properties.publicClient().googleIdpAlias())
            .build()
            .encode()
            .toUriString();

        return new PublicGoogleStartResponse(authorizationUrl, state, "S256", codeVerifier);
    }

    public AuthSessionResponse completePublicGoogleLogin(String code, String state, String codeVerifier, String device, String ip) {
        LoginFlowState flow = loginFlowStatePort.consume(state);
        String resolvedCodeVerifier = flow != null ? flow.codeVerifier() : codeVerifier;

        if ((flow == null && (resolvedCodeVerifier == null || resolvedCodeVerifier.isBlank()))
            || (flow != null && flow.expiresAt().isBefore(Instant.now()) && (codeVerifier == null || codeVerifier.isBlank()))) {
            throw new BadRequestException("AUTH_INVALID_STATE", "Invalid or expired state");
        }

        IdentityAuthResult authResult = identityProviderPort.exchangePublicGoogleCode(code, resolvedCodeVerifier);
        UserProfile profile = userProfilePort.createOrGetFromIdentity(authResult.user());
        sessionPort.create(profile.userId(), device, ip, "LOW", authResult.tokens());

        return toAuthSessionResponse(authResult.tokens(), profile, "LOW");
    }

    public void logout(String userId, LogoutRequest request) {
        if (request.refreshToken() != null && !request.refreshToken().isBlank()) {
            identityProviderPort.logout(request.refreshToken());
        }
        if (request.allSessions()) {
            sessionPort.revokeAll(userId);
        }
    }

    public OtpChallengeResponse requestStepUpOtp(OtpRequest request) {
        String challengeId = UUID.randomUUID().toString();
        return new OtpChallengeResponse(challengeId, 300, 30);
    }

    public StepUpVerifyResponse verifyStepUpOtp(OtpVerifyRequest request) {
        return new StepUpVerifyResponse(true, Instant.now().plusSeconds(600).toString());
    }

    public CorpLoginInitResponse initCorpLogin(CorpLoginInitRequest request) {
        return new CorpLoginInitResponse(UUID.randomUUID().toString(), List.of("PASSKEY", "TOTP", "EMAIL_OTP"), true);
    }

    public CorpLoginVerifyResponse verifyCorpLogin(CorpLoginVerifyRequest request) {
        return new CorpLoginVerifyResponse(null, true, "MFA_REQUIRED", Map.of("loginFlowId", request.loginFlowId()));
    }

    public Object challengeCorpMfa(CorpMfaChallengeRequest request) {
        if ("PASSKEY".equalsIgnoreCase(request.factorType())) {
            return new WebAuthnChallengeResponse(UUID.randomUUID().toString(), "localhost", 60000);
        }
        return new OtpChallengeResponse(UUID.randomUUID().toString(), 300, 30);
    }

    public AuthSessionResponse verifyCorpMfa(CorpMfaVerifyRequest request, String device, String ip) {
        IdentityUser corpUser = new IdentityUser(
            UUID.randomUUID().toString(),
            "staff@airline.com",
            "Corp",
            "User",
            "+910000000000",
            "CORP",
            List.of("OPS_AGENT")
        );
        IdentityTokens tokens = new IdentityTokens(randomToken(), randomToken(), 600);
        UserProfile profile = userProfilePort.createOrGetFromIdentity(corpUser);
        sessionPort.create(profile.userId(), device, ip, "MEDIUM", tokens);
        return toAuthSessionResponse(tokens, profile, "MFA");
    }

    public AuthSessionResponse refresh(String refreshToken) {
        IdentityTokens tokens = identityProviderPort.refresh(refreshToken);
        UserProfile profile = userProfilePort.getByUserId("dev-user");
        if (profile == null) {
            profile = new UserProfile(
                "dev-user",
                "customer@example.com",
                "Sky",
                "Fly",
                null,
                false,
                "PUBLIC",
                List.of("CUSTOMER"),
                "INCOMPLETE",
                Instant.now()
            );
        }
        return toAuthSessionResponse(tokens, profile, "LOW");
    }

    public MeResponse getMe(String userId) {
        UserProfile profile = userProfilePort.getByUserId(userId);
        if (profile == null) {
            throw new NotFoundException("USER_NOT_FOUND", "User not found");
        }
        return toMeResponse(profile);
    }

    public MeResponse updateMe(String userId, UpdateMeRequest request) {
        UserProfile updated = userProfilePort.update(userId, request.firstName(), request.lastName(), request.mobile());
        return toMeResponse(updated);
    }

    public SessionListResponse getMySessions(String userId) {
        List<SessionInfo> sessions = sessionPort.getByUserId(userId).stream()
            .map(s -> new SessionInfo(
                s.sessionId(),
                s.device(),
                s.ip(),
                s.createdAt().toString(),
                s.lastSeenAt().toString(),
                s.riskLevel()
            ))
            .toList();
        return new SessionListResponse(sessions);
    }

    public void revokeSession(String userId, String sessionId) {
        sessionPort.revoke(userId, sessionId);
    }

    public void createCorpUser(CorpUserCreateRequest request) {
        // Placeholder for SCIM/Keycloak admin provisioning integration.
    }

    public void updateCorpUser(String id, CorpUserUpdateRequest request) {
        // Placeholder for corp user lifecycle updates.
    }

    public void enableCorpUser(String id) {
        // Placeholder for enable operation in identity provider.
    }

    public void disableCorpUser(String id) {
        // Placeholder for disable operation in identity provider.
    }

    public void assignRole(String id, String roleId) {
        // Placeholder for role assignment via Keycloak admin API.
    }

    public void removeRole(String id, String roleId) {
        // Placeholder for role unassignment via Keycloak admin API.
    }

    public void forceMfaReset(String id) {
        // Placeholder for forced credential reset workflow.
    }

    public void revokeAllSessionsForUser(String userId) {
        sessionPort.revokeAll(userId);
    }

    private AuthSessionResponse toAuthSessionResponse(IdentityTokens tokens, UserProfile profile, String mfaLevel) {
        return new AuthSessionResponse(
            new TokenPair(tokens.accessToken(), tokens.refreshToken(), tokens.expiresIn()),
            new UserSummary(profile.userId(), profile.email(), profile.realm(), "ACTIVE", profile.roles()),
            "INCOMPLETE".equalsIgnoreCase(profile.profileStatus()),
            profile.profileStatus(),
            mfaLevel
        );
    }

    private MeResponse toMeResponse(UserProfile profile) {
        return new MeResponse(
            profile.userId(),
            profile.email(),
            profile.firstName(),
            profile.lastName(),
            profile.mobile(),
            profile.mobileVerified(),
            profile.realm(),
            profile.roles(),
            profile.profileStatus()
        );
    }

    private static String sha256Base64Url(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new ConfigurationException("CRYPTO_ALGORITHM_MISSING", "Unable to compute SHA-256");
        }
    }

    private static String randomToken() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(UUID.randomUUID().toString().getBytes(StandardCharsets.UTF_8));
    }

    private String resolveKeycloakPublicBaseUrl() {
        if (properties.keycloak() != null && properties.keycloak().publicBaseUrl() != null
            && !properties.keycloak().publicBaseUrl().isBlank()) {
            return properties.keycloak().publicBaseUrl();
        }
        return properties.keycloak().baseUrl();
    }
}
