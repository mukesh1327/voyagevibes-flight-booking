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
import com.cloudxplorer.authservice.domain.model.CorpUserRecord;
import com.cloudxplorer.authservice.domain.port.AuditEventPort;
import com.cloudxplorer.authservice.domain.port.CorpUserAdminPort;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthApplicationService {

    private static final long FLOW_EXPIRY_SECONDS = 300;
    private static final Set<String> CORP_STEP_UP_ROLES = Set.of("CORP_ADMIN", "FINANCE_AGENT");
    private static final List<String> CORP_FACTORS = List.of("PASSWORD");

    private final AuthServiceProperties properties;
    private final IdentityProviderPort identityProviderPort;
    private final LoginFlowStatePort loginFlowStatePort;
    private final UserProfilePort userProfilePort;
    private final SessionPort sessionPort;
    private final CorpUserAdminPort corpUserAdminPort;
    private final AuditEventPort auditEventPort;

    public AuthApplicationService(
        AuthServiceProperties properties,
        IdentityProviderPort identityProviderPort,
        LoginFlowStatePort loginFlowStatePort,
        UserProfilePort userProfilePort,
        SessionPort sessionPort,
        CorpUserAdminPort corpUserAdminPort,
        AuditEventPort auditEventPort
    ) {
        this.properties = properties;
        this.identityProviderPort = identityProviderPort;
        this.loginFlowStatePort = loginFlowStatePort;
        this.userProfilePort = userProfilePort;
        this.sessionPort = sessionPort;
        this.corpUserAdminPort = corpUserAdminPort;
        this.auditEventPort = auditEventPort;
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
        if (request == null || request.email() == null || request.email().isBlank()) {
            throw new BadRequestException("CORP_EMAIL_REQUIRED", "Email is required");
        }

        CorpUserRecord corpUser = corpUserAdminPort.getByEmail(request.email().trim());
        if (corpUser == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }

        if (!"ACTIVE".equalsIgnoreCase(corpUser.status())) {
            throw new BadRequestException("CORP_USER_DISABLED", "Corp user is disabled");
        }

        String loginFlowId = "corp-" + UUID.randomUUID();
        loginFlowStatePort.save(new LoginFlowState(
            loginFlowId,
            "corp:" + corpUser.userId(),
            Instant.now().plusSeconds(FLOW_EXPIRY_SECONDS)
        ));

        boolean requiresStepUp = false;
        auditEventPort.record(
            corpUser.userId(),
            "CORP_LOGIN_INIT",
            Map.of("email", corpUser.email(), "loginFlowId", loginFlowId, "requiresStepUp", requiresStepUp)
        );

        return new CorpLoginInitResponse(loginFlowId, CORP_FACTORS, requiresStepUp);
    }

    public CorpLoginVerifyResponse verifyCorpLogin(CorpLoginVerifyRequest request) {
        if (request == null || request.loginFlowId() == null || request.loginFlowId().isBlank()) {
            throw new BadRequestException("CORP_LOGIN_FLOW_REQUIRED", "loginFlowId is required");
        }
        if (request.factorType() == null || request.factorType().isBlank()) {
            throw new BadRequestException("CORP_FACTOR_REQUIRED", "factorType is required");
        }
        if (request.assertion() == null || request.assertion().isBlank()) {
            throw new BadRequestException("CORP_ASSERTION_REQUIRED", "assertion is required");
        }

        LoginFlowState flow = loginFlowStatePort.get(request.loginFlowId());
        if (flow == null || flow.expiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("CORP_LOGIN_EXPIRED", "Login flow is invalid or expired");
        }

        String userId = extractCorpUserId(flow);
        CorpUserRecord corpUser = corpUserAdminPort.getById(userId);
        if (corpUser == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }

        if (!"ACTIVE".equalsIgnoreCase(corpUser.status())) {
            throw new BadRequestException("CORP_USER_DISABLED", "Corp user is disabled");
        }

        String normalizedFactor = request.factorType().trim().toUpperCase();
        if (!CORP_FACTORS.contains(normalizedFactor)) {
            throw new BadRequestException("CORP_FACTOR_UNSUPPORTED", "Unsupported factor type");
        }

        if (!"PASSWORD".equalsIgnoreCase(normalizedFactor)) {
            throw new BadRequestException("CORP_FACTOR_UNSUPPORTED", "Unsupported factor type");
        }

        IdentityAuthResult authResult = identityProviderPort.exchangeCorpPassword(corpUser.email(), request.assertion());
        if (authResult == null || authResult.tokens() == null) {
            throw new BadRequestException("CORP_LOGIN_FAILED", "Corporate login failed");
        }
        if (authResult.user() != null && authResult.user().email() != null
            && !authResult.user().email().equalsIgnoreCase(corpUser.email())) {
            throw new BadRequestException("CORP_IDENTITY_MISMATCH", "Corporate identity does not match request");
        }

        loginFlowStatePort.consume(request.loginFlowId());
        AuthSessionResponse session = issueCorpSession(
            corpUser,
            authResult.tokens(),
            "LOW",
            "corp-login",
            "unknown"
        );
        auditEventPort.record(
            corpUser.userId(),
            "CORP_LOGIN_SUCCESS",
            Map.of("loginFlowId", request.loginFlowId(), "factor", normalizedFactor, "keycloak", true)
        );
        return new CorpLoginVerifyResponse(session, false, null, Collections.emptyMap());
    }

    public Object challengeCorpMfa(CorpMfaChallengeRequest request) {
        if (request == null || request.loginFlowId() == null || request.loginFlowId().isBlank()) {
            throw new BadRequestException("CORP_LOGIN_FLOW_REQUIRED", "loginFlowId is required");
        }
        LoginFlowState flow = loginFlowStatePort.get(request.loginFlowId());
        if (flow == null || flow.expiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("CORP_LOGIN_EXPIRED", "Login flow is invalid or expired");
        }

        if ("PASSKEY".equalsIgnoreCase(request.factorType())) {
            return new WebAuthnChallengeResponse(UUID.randomUUID().toString(), "localhost", 60000);
        }
        return new OtpChallengeResponse("mfa:" + request.loginFlowId(), 300, 30);
    }

    public AuthSessionResponse verifyCorpMfa(CorpMfaVerifyRequest request, String device, String ip) {
        if (request == null || request.challengeId() == null || request.challengeId().isBlank()) {
            throw new BadRequestException("CORP_CHALLENGE_REQUIRED", "challengeId is required");
        }

        String loginFlowId = extractLoginFlowId(request.challengeId());
        if (loginFlowId == null) {
            throw new BadRequestException("CORP_CHALLENGE_INVALID", "challengeId is invalid");
        }

        LoginFlowState flow = loginFlowStatePort.consume(loginFlowId);
        if (flow == null || flow.expiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("CORP_LOGIN_EXPIRED", "Login flow is invalid or expired");
        }

        String userId = extractCorpUserId(flow);
        CorpUserRecord corpUser = corpUserAdminPort.getById(userId);
        if (corpUser == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }

        if (!"ACTIVE".equalsIgnoreCase(corpUser.status())) {
            throw new BadRequestException("CORP_USER_DISABLED", "Corp user is disabled");
        }

        AuthSessionResponse session = issueCorpSessionWithRandomTokens(
            corpUser,
            "MFA",
            device == null || device.isBlank() ? "corp-login" : device,
            ip == null || ip.isBlank() ? "unknown" : ip
        );
        auditEventPort.record(
            corpUser.userId(),
            "CORP_LOGIN_SUCCESS",
            Map.of("loginFlowId", loginFlowId, "mfa", true)
        );
        return session;
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
        if (request == null || request.email() == null || request.email().isBlank()) {
            throw new BadRequestException("CORP_EMAIL_REQUIRED", "Email is required");
        }
        if (request.roleIds() == null || request.roleIds().isEmpty()) {
            throw new BadRequestException("CORP_ROLES_REQUIRED", "At least one role is required");
        }

        CorpUserRecord corpUser = corpUserAdminPort.create(
            request.email().trim(),
            request.roleIds(),
            request.department(),
            request.managerId()
        );

        auditEventPort.record(
            corpUser.userId(),
            "CORP_USER_CREATED",
            Map.of("email", corpUser.email(), "roles", corpUser.roles())
        );
    }

    public void updateCorpUser(String id, CorpUserUpdateRequest request) {
        CorpUserRecord updated = corpUserAdminPort.update(
            id,
            request == null ? null : request.status(),
            request == null ? null : request.department(),
            request == null ? null : request.managerId()
        );

        if (updated == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }

        var payload = new java.util.HashMap<String, Object>();
        payload.put("status", updated.status());
        payload.put("department", updated.department());
        payload.put("managerId", updated.managerId());
        auditEventPort.record(
            updated.userId(),
            "CORP_USER_UPDATED",
            payload
        );
    }

    public void enableCorpUser(String id) {
        CorpUserRecord existing = corpUserAdminPort.getById(id);
        if (existing == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }
        corpUserAdminPort.setStatus(id, "ACTIVE");
        auditEventPort.record(id, "CORP_USER_ENABLED", Map.of("userId", id));
    }

    public void disableCorpUser(String id) {
        CorpUserRecord existing = corpUserAdminPort.getById(id);
        if (existing == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }
        corpUserAdminPort.setStatus(id, "DISABLED");
        sessionPort.revokeAll(id);
        auditEventPort.record(id, "CORP_USER_DISABLED", Map.of("userId", id));
    }

    public void assignRole(String id, String roleId) {
        CorpUserRecord updated = corpUserAdminPort.addRole(id, roleId);
        if (updated == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }
        auditEventPort.record(id, "CORP_ROLE_ASSIGNED", Map.of("roleId", roleId));
    }

    public void removeRole(String id, String roleId) {
        CorpUserRecord updated = corpUserAdminPort.removeRole(id, roleId);
        if (updated == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }
        auditEventPort.record(id, "CORP_ROLE_REMOVED", Map.of("roleId", roleId));
    }

    public void forceMfaReset(String id) {
        CorpUserRecord existing = corpUserAdminPort.getById(id);
        if (existing == null) {
            throw new NotFoundException("CORP_USER_NOT_FOUND", "Corp user not found");
        }
        auditEventPort.record(id, "CORP_FORCE_MFA_RESET", Map.of("userId", id));
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

    private boolean requiresStepUp(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return true;
        }
        return roles.stream().anyMatch(role -> CORP_STEP_UP_ROLES.contains(role.toUpperCase()));
    }

    private AuthSessionResponse issueCorpSession(
        CorpUserRecord corpUser,
        IdentityTokens tokens,
        String mfaLevel,
        String device,
        String ip
    ) {
        UserProfile profile = userProfilePort.getByUserId(corpUser.userId());
        if (profile == null) {
            throw new NotFoundException("CORP_PROFILE_MISSING", "Corp profile is missing");
        }

        sessionPort.create(profile.userId(), device, ip, mfaLevel, tokens);
        return toAuthSessionResponse(tokens, profile, mfaLevel);
    }

    private AuthSessionResponse issueCorpSessionWithRandomTokens(
        CorpUserRecord corpUser,
        String mfaLevel,
        String device,
        String ip
    ) {
        return issueCorpSession(
            corpUser,
            new IdentityTokens(randomToken(), randomToken(), 600),
            mfaLevel,
            device,
            ip
        );
    }

    private static String extractCorpUserId(LoginFlowState flow) {
        if (flow == null || flow.codeVerifier() == null) {
            return null;
        }
        String value = flow.codeVerifier();
        if (value.startsWith("corp:")) {
            return value.substring("corp:".length());
        }
        return value;
    }

    private static String extractLoginFlowId(String challengeId) {
        String trimmed = challengeId.trim();
        if (trimmed.startsWith("mfa:")) {
            return trimmed.substring("mfa:".length());
        }
        return null;
    }
}
