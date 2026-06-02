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
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthenticationService {

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
                keycloak.issuerUri(),
                keycloak.getClientId(),
                keycloak.authorizationEndpoint(),
                keycloak.tokenEndpoint(),
                keycloak.logoutEndpoint(),
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
                        authorizationParameters(keycloak.getGoogleProviderAlias())
                ),
                new AuthFrontendConfigResponse.LoginFlowConfig(
                        "corporate",
                        "/auth/corporate/login",
                        null,
                        properties.getSecurity().getCorporateRole(),
                        null,
                        false,
                        authorizationParameters(null)
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
        Map<String, Object> claims = JwtClaimUtils.decodeClaims(tokenResponse.accessToken());
        Set<String> roles = roleExtractor.extractRoles(claims, properties.getKeycloak().getClientId());
        UserAccessProfile accessProfile = userAccessResolver.resolve(roles);
        Map<String, Object> userInfo = keycloakClient.fetchUserInfo(tokenResponse.accessToken());
        KeycloakUserProfile profile = toUserProfile(claims, userInfo);

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

    private KeycloakUserProfile toUserProfile(Map<String, Object> claims, Map<String, Object> userInfo) {
        String identityProvider = stringValue(claims.get("identity_provider"));
        if (!StringUtils.hasText(identityProvider)) {
            identityProvider = stringValue(claims.get("idp_alias"));
        }
        if (!StringUtils.hasText(identityProvider)) {
            identityProvider = "keycloak";
        }
        return new KeycloakUserProfile(
                stringValue(userInfo.getOrDefault("sub", claims.get("sub"))),
                stringValue(userInfo.getOrDefault("preferred_username", claims.get("preferred_username"))),
                stringValue(userInfo.getOrDefault("email", claims.get("email"))),
                stringValue(userInfo.getOrDefault("name", claims.get("name"))),
                stringValue(userInfo.getOrDefault("given_name", claims.get("given_name"))),
                stringValue(userInfo.getOrDefault("family_name", claims.get("family_name"))),
                booleanValue(userInfo.getOrDefault("email_verified", claims.get("email_verified"))),
                identityProvider,
                stringValue(claims.get("iss"))
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
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("client_id", properties.getKeycloak().getClientId());
        parameters.put("response_type", properties.getKeycloak().getAuthorizationResponseType());
        parameters.put("scope", properties.getKeycloak().getAuthorizationScope());
        parameters.put("code_challenge_method", properties.getKeycloak().getPkceCodeChallengeMethod());
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
}
