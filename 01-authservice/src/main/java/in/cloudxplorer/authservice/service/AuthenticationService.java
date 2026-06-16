package in.cloudxplorer.authservice.service;

import in.cloudxplorer.authservice.client.KeycloakClient;
import in.cloudxplorer.authservice.client.KeycloakClient.TokenEndpointResponse;
import in.cloudxplorer.authservice.config.AuthServiceProperties;
import in.cloudxplorer.authservice.dto.AuthCodeExchangeRequest;
import in.cloudxplorer.authservice.dto.AuthFrontendConfigResponse;
import in.cloudxplorer.authservice.dto.AuthTokenResponse;
import in.cloudxplorer.authservice.dto.AuthenticatedUserResponse;
import in.cloudxplorer.authservice.dto.CustomerProfileResponse;
import in.cloudxplorer.authservice.dto.LogoutRequest;
import in.cloudxplorer.authservice.exception.AuthServiceException;
import in.cloudxplorer.authservice.model.KeycloakSession;
import in.cloudxplorer.authservice.model.KeycloakUserProfile;
import in.cloudxplorer.authservice.model.UserType;
import in.cloudxplorer.authservice.security.KeycloakRoleExtractor;
import in.cloudxplorer.authservice.security.UserAccessProfile;
import in.cloudxplorer.authservice.security.UserAccessResolver;
import in.cloudxplorer.authservice.util.JwtClaimUtils;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthenticationService {

    private static final Logger logger = LoggerFactory.getLogger(AuthenticationService.class);

    private final KeycloakClient keycloakClient;
    private final KeycloakRoleExtractor roleExtractor;
    private final UserAccessResolver userAccessResolver;
    private final CustomerProfileService customerProfileService;
    private final AuthServiceProperties properties;

    public AuthenticationService(
            KeycloakClient keycloakClient,
            KeycloakRoleExtractor roleExtractor,
            UserAccessResolver userAccessResolver,
            CustomerProfileService customerProfileService,
            AuthServiceProperties properties
    ) {
        this.keycloakClient = keycloakClient;
        this.roleExtractor = roleExtractor;
        this.userAccessResolver = userAccessResolver;
        this.customerProfileService = customerProfileService;
        this.properties = properties;
    }

    @Transactional
    public AuthTokenResponse registerCustomer(AuthCodeExchangeRequest request) {
        KeycloakSession session = authenticate(request, UserType.CUSTOMER, true);
        CustomerProfileService.UpsertResult upsert = customerProfileService.upsert(session.userProfile());
        return toTokenResponse(session, UserType.CUSTOMER, upsert.created(), upsert.profile());
    }

    @Transactional
    public AuthTokenResponse loginCustomer(AuthCodeExchangeRequest request) {
        KeycloakSession session = authenticate(request, UserType.CUSTOMER, true);
        CustomerProfileService.UpsertResult upsert = customerProfileService.upsert(session.userProfile());
        return toTokenResponse(session, UserType.CUSTOMER, upsert.created(), upsert.profile());
    }

    public AuthTokenResponse loginCorporate(AuthCodeExchangeRequest request) {
        KeycloakSession session = authenticate(request, UserType.CORPORATE, false);
        return toTokenResponse(session, UserType.CORPORATE, false, null);
    }

    public void logout(LogoutRequest request) {
        keycloakClient.logout(request.refreshToken());
    }

    public AuthFrontendConfigResponse frontendConfig() {
        AuthServiceProperties.Keycloak keycloak = properties.getKeycloak();
        return new AuthFrontendConfigResponse(
                keycloak.getRealm(),
                keycloak.publicIssuerUri(),
                keycloak.getClientId(),
                keycloak.publicAuthorizationEndpoint(),
                keycloak.publicTokenEndpoint(),
                keycloak.publicLogoutEndpoint(),
                keycloak.getDefaultRedirectUri(),
                keycloak.getAuthorizationScope(),
                keycloak.getAuthorizationResponseType(),
                true,
                keycloak.getPkceCodeChallengeMethod(),
                new AuthFrontendConfigResponse.LoginFlowConfig(
                        "customer",
                        "/auth/customer/login",
                        "/auth/customer/register",
                        properties.getSecurity().getCustomerRole(),
                        keycloak.getGoogleProviderAlias(),
                        true,
                        authorizationParameters(keycloak.getGoogleProviderAlias(), true)
                ),
                new AuthFrontendConfigResponse.LoginFlowConfig(
                        "corporate",
                        "/auth/corporate/login",
                        null,
                        properties.getSecurity().getCorporateRole(),
                        null,
                        false,
                        authorizationParameters(null, true)
                ),
                properties.getSecurity().getCorporateSubRoles().stream()
                        .map(role -> new AuthFrontendConfigResponse.CorporateRoleDescriptor(
                                role.getCode(),
                                role.getDisplayName(),
                                role.getDescription()
                        ))
                        .toList()
        );
    }

    @Transactional
    public void deleteCustomer(String customerId, Authentication authentication) {
        Jwt jwt = extractJwt(authentication);
        Set<String> roles = userAccessResolver.normalize(
                roleExtractor.extractRoles(jwt.getClaims(), properties.getKeycloak().getClientId())
        );
        boolean admin = userAccessResolver.hasRole(roles, properties.getSecurity().getAdminRole());
        boolean self = customerId.equals(jwt.getSubject());
        if (!admin && !self) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, "You can only delete your own customer account");
        }

        keycloakClient.deleteUser(customerId);
        customerProfileService.deleteByKeycloakUserId(customerId);
    }

    public AuthenticatedUserResponse me(Authentication authentication) {
        Jwt jwt = extractJwt(authentication);
        Set<String> roles = roleExtractor.extractRoles(jwt.getClaims(), properties.getKeycloak().getClientId());
        boolean active = true;
        if (StringUtils.hasText(properties.getKeycloak().getAdminClientSecret())) {
            Map<String, Object> introspection = keycloakClient.introspect(jwt.getTokenValue());
            active = Boolean.TRUE.equals(introspection.get("active"));
        }
        return toAuthenticatedUserResponse(jwt.getClaims(), roles, active);
    }

    private KeycloakSession authenticate(AuthCodeExchangeRequest request, UserType userType, boolean enforceGoogleBroker) {
        TokenEndpointResponse tokenResponse = keycloakClient.exchangeAuthorizationCode(request);
        Map<String, Object> accessTokenClaims = JwtClaimUtils.decodeClaims(tokenResponse.accessToken());
        Map<String, Object> idTokenClaims = JwtClaimUtils.decodeClaims(tokenResponse.idToken());
        Set<String> roles = roleExtractor.extractRoles(accessTokenClaims, properties.getKeycloak().getClientId());
        UserAccessProfile accessProfile = userAccessResolver.resolve(roles);
        Map<String, Object> userInfo = fetchUserInfoOrFallback(tokenResponse.accessToken());
        KeycloakUserProfile profile = toUserProfile(accessTokenClaims, idTokenClaims, userInfo);

        if (userType == UserType.CUSTOMER) {
            ensureUserType(accessProfile, UserType.CUSTOMER, "Customer role is required");
            if (enforceGoogleBroker
                    && StringUtils.hasText(profile.identityProvider())
                    && !properties.getKeycloak().getGoogleProviderAlias().equalsIgnoreCase(profile.identityProvider())) {
                throw new AuthServiceException(HttpStatus.FORBIDDEN, "Customer sign-in must come from Google via Keycloak");
            }
        } else {
            ensureUserType(accessProfile, UserType.CORPORATE, "Corporate role is required");
        }

        boolean active = true;
        if (StringUtils.hasText(properties.getKeycloak().getAdminClientSecret())) {
            Map<String, Object> introspection = keycloakClient.introspect(tokenResponse.accessToken());
            active = Boolean.TRUE.equals(introspection.get("active"));
        }

        return new KeycloakSession(
                tokenResponse.accessToken(),
                tokenResponse.refreshToken(),
                tokenResponse.idToken(),
                tokenResponse.tokenType(),
                tokenResponse.expiresIn(),
                tokenResponse.scope(),
                profile,
                accessProfile.applicationRoles(),
                active
        );
    }

    private void ensureUserType(UserAccessProfile accessProfile, UserType expectedType, String message) {
        if (accessProfile.userType() != expectedType) {
            throw new AuthServiceException(HttpStatus.FORBIDDEN, message);
        }
    }

    private KeycloakUserProfile toUserProfile(
            Map<String, Object> accessTokenClaims,
            Map<String, Object> idTokenClaims,
            Map<String, Object> userInfo
    ) {
        String identityProvider = resolveIdentityProvider(userInfo, accessTokenClaims, idTokenClaims);
        String subject = firstNonBlankValue(
                userInfo.get("sub"),
                accessTokenClaims.get("sub"),
                idTokenClaims.get("sub")
        );
        if (!StringUtils.hasText(subject)) {
            logger.warn("Resolved Keycloak user profile without a subject; userinfo and token claims did not contain a usable sub");
        }

        return new KeycloakUserProfile(
                subject,
                firstNonBlankValue(
                        userInfo.get("preferred_username"),
                        accessTokenClaims.get("preferred_username"),
                        idTokenClaims.get("preferred_username")
                ),
                firstNonBlankValue(
                        userInfo.get("email"),
                        accessTokenClaims.get("email"),
                        idTokenClaims.get("email")
                ),
                firstNonBlankValue(
                        userInfo.get("name"),
                        accessTokenClaims.get("name"),
                        idTokenClaims.get("name")
                ),
                firstNonBlankValue(
                        userInfo.get("given_name"),
                        accessTokenClaims.get("given_name"),
                        idTokenClaims.get("given_name")
                ),
                firstNonBlankValue(
                        userInfo.get("family_name"),
                        accessTokenClaims.get("family_name"),
                        idTokenClaims.get("family_name")
                ),
                booleanValue(firstNonNull(
                        userInfo.get("email_verified"),
                        accessTokenClaims.get("email_verified"),
                        idTokenClaims.get("email_verified")
                )),
                identityProvider,
                firstNonBlankValue(
                        accessTokenClaims.get("iss"),
                        idTokenClaims.get("iss")
                )
        );
    }

    private AuthTokenResponse toTokenResponse(
            KeycloakSession session,
            UserType userType,
            boolean newlyRegistered,
            CustomerProfileResponse customerProfile
    ) {
        UserAccessProfile accessProfile = userAccessResolver.resolve(session.roles());
        AuthenticatedUserResponse user = new AuthenticatedUserResponse(
                session.userProfile().subject(),
                session.userProfile().username(),
                session.userProfile().email(),
                session.userProfile().fullName(),
                accessProfile.applicationRoles(),
                accessProfile.baseRole(),
                accessProfile.corporateRoles(),
                accessProfile.userType().name(),
                session.userProfile().identityProvider(),
                session.userProfile().issuer(),
                session.tokenActive()
        );
        return new AuthTokenResponse(
                session.tokenType(),
                session.expiresIn(),
                session.scope(),
                userType.name(),
                newlyRegistered,
                session.accessToken(),
                session.refreshToken(),
                session.idToken(),
                user,
                customerProfile
        );
    }

    private AuthenticatedUserResponse toAuthenticatedUserResponse(Map<String, Object> claims, Set<String> roles, boolean active) {
        UserAccessProfile accessProfile = userAccessResolver.resolve(roles);
        return new AuthenticatedUserResponse(
                stringValue(claims.get("sub")),
                stringValue(claims.get("preferred_username")),
                stringValue(claims.get("email")),
                stringValue(claims.get("name")),
                accessProfile.applicationRoles(),
                accessProfile.baseRole(),
                accessProfile.corporateRoles(),
                accessProfile.userType().name(),
                firstNonBlank(stringValue(claims.get("identity_provider")), stringValue(claims.get("idp_alias")), "keycloak"),
                stringValue(claims.get("iss")),
                active
        );
    }

    private Map<String, String> authorizationParameters(String identityProviderHint) {
        return authorizationParameters(identityProviderHint, false);
    }

    private Map<String, String> authorizationParameters(String identityProviderHint, boolean forceFreshLogin) {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("client_id", properties.getKeycloak().getClientId());
        parameters.put("response_type", properties.getKeycloak().getAuthorizationResponseType());
        parameters.put("scope", properties.getKeycloak().getAuthorizationScope());
        parameters.put("code_challenge_method", properties.getKeycloak().getPkceCodeChallengeMethod());
        if (forceFreshLogin) {
            parameters.put("prompt", "login");
        }
        if (StringUtils.hasText(identityProviderHint)) {
            parameters.put("kc_idp_hint", identityProviderHint);
        }
        return parameters;
    }

    private Jwt extractJwt(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new AuthServiceException(HttpStatus.UNAUTHORIZED, "Missing authenticated JWT principal");
        }
        return jwt;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean booleanValue(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private String firstNonBlank(String first, String second, String fallback) {
        if (StringUtils.hasText(first)) {
            return first;
        }
        if (StringUtils.hasText(second)) {
            return second;
        }
        return fallback;
    }

    private String resolveIdentityProvider(
            Map<String, Object> userInfo,
            Map<String, Object> accessTokenClaims,
            Map<String, Object> idTokenClaims
    ) {
        return firstNonBlankValue(
                userInfo.get("identity_provider"),
                userInfo.get("idp_alias"),
                accessTokenClaims.get("identity_provider"),
                accessTokenClaims.get("idp_alias"),
                idTokenClaims.get("identity_provider"),
                idTokenClaims.get("idp_alias")
        );
    }

    private Object firstNonNull(Object... values) {
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlankValue(Object... values) {
        for (Object value : values) {
            String stringValue = stringValue(value);
            if (StringUtils.hasText(stringValue)) {
                return stringValue.strip();
            }
        }
        return null;
    }

    private Map<String, Object> fetchUserInfoOrFallback(String accessToken) {
        try {
            return keycloakClient.fetchUserInfo(accessToken);
        } catch (Exception ex) {
            logger.warn("Keycloak userinfo lookup failed; continuing with token claims only: {}", ex.getMessage());
            return Map.of();
        }
    }
}
