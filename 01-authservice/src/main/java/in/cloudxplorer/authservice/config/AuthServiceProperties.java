package in.cloudxplorer.authservice.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app")
public class AuthServiceProperties {

    private final Keycloak keycloak = new Keycloak();
    private final Security security = new Security();
    private final Observability observability = new Observability();
    private final Logging logging = new Logging();

    public Keycloak getKeycloak() {
        return keycloak;
    }

    public Security getSecurity() {
        return security;
    }

    public Observability getObservability() {
        return observability;
    }

    public Logging getLogging() {
        return logging;
    }

    public static class Keycloak {

        @NotBlank
        private String baseUrl;
        private String publicBaseUrl;

        @NotBlank
        private String realm;

        @NotBlank
        private String clientId;

        private String clientSecret;
        private String adminClientId;
        private String adminClientSecret;
        private String defaultRedirectUri;
        private String googleProviderAlias;
        private String authorizationScope = "openid profile email";
        private String authorizationResponseType = "code";
        private String pkceCodeChallengeMethod = "S256";
        private Duration connectTimeout = Duration.ofSeconds(5);
        private Duration readTimeout = Duration.ofSeconds(5);
        private String trustStorePath;
        private String trustStorePassword;
        private String trustStoreType = "PKCS12";

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = trimTrailingSlash(baseUrl);
        }

        public String getPublicBaseUrl() {
            return StringUtils.hasText(publicBaseUrl) ? publicBaseUrl : baseUrl;
        }

        public void setPublicBaseUrl(String publicBaseUrl) {
            this.publicBaseUrl = trimTrailingSlash(publicBaseUrl);
        }

        public String getRealm() {
            return realm;
        }

        public void setRealm(String realm) {
            this.realm = realm;
        }

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public String getAdminClientId() {
            return adminClientId;
        }

        public void setAdminClientId(String adminClientId) {
            this.adminClientId = adminClientId;
        }

        public String getAdminClientSecret() {
            return adminClientSecret;
        }

        public void setAdminClientSecret(String adminClientSecret) {
            this.adminClientSecret = adminClientSecret;
        }

        public String getDefaultRedirectUri() {
            return defaultRedirectUri;
        }

        public void setDefaultRedirectUri(String defaultRedirectUri) {
            this.defaultRedirectUri = defaultRedirectUri;
        }

        public String getGoogleProviderAlias() {
            return googleProviderAlias;
        }

        public void setGoogleProviderAlias(String googleProviderAlias) {
            this.googleProviderAlias = googleProviderAlias;
        }

        public String getAuthorizationScope() {
            return authorizationScope;
        }

        public void setAuthorizationScope(String authorizationScope) {
            this.authorizationScope = authorizationScope;
        }

        public String getAuthorizationResponseType() {
            return authorizationResponseType;
        }

        public void setAuthorizationResponseType(String authorizationResponseType) {
            this.authorizationResponseType = authorizationResponseType;
        }

        public String getPkceCodeChallengeMethod() {
            return pkceCodeChallengeMethod;
        }

        public void setPkceCodeChallengeMethod(String pkceCodeChallengeMethod) {
            this.pkceCodeChallengeMethod = pkceCodeChallengeMethod;
        }

        public Duration getConnectTimeout() {
            return connectTimeout;
        }

        public void setConnectTimeout(Duration connectTimeout) {
            this.connectTimeout = connectTimeout;
        }

        public Duration getReadTimeout() {
            return readTimeout;
        }

        public void setReadTimeout(Duration readTimeout) {
            this.readTimeout = readTimeout;
        }

        public String getTrustStorePath() {
            return trustStorePath;
        }

        public void setTrustStorePath(String trustStorePath) {
            this.trustStorePath = trustStorePath;
        }

        public String getTrustStorePassword() {
            return trustStorePassword;
        }

        public void setTrustStorePassword(String trustStorePassword) {
            this.trustStorePassword = trustStorePassword;
        }

        public String getTrustStoreType() {
            return trustStoreType;
        }

        public void setTrustStoreType(String trustStoreType) {
            this.trustStoreType = trustStoreType;
        }

        public String issuerUri() {
            return baseUrl + "/realms/" + realm;
        }

        public String publicIssuerUri() {
            return getPublicBaseUrl() + "/realms/" + realm;
        }

        public String jwkSetUri() {
            return issuerUri() + "/protocol/openid-connect/certs";
        }

        public String tokenEndpoint() {
            return issuerUri() + "/protocol/openid-connect/token";
        }

        public String authorizationEndpoint() {
            return issuerUri() + "/protocol/openid-connect/auth";
        }

        public String publicAuthorizationEndpoint() {
            return publicIssuerUri() + "/protocol/openid-connect/auth";
        }

        public String logoutEndpoint() {
            return issuerUri() + "/protocol/openid-connect/logout";
        }

        public String publicLogoutEndpoint() {
            return publicIssuerUri() + "/protocol/openid-connect/logout";
        }

        public String publicTokenEndpoint() {
            return publicIssuerUri() + "/protocol/openid-connect/token";
        }

        public String userInfoEndpoint() {
            return issuerUri() + "/protocol/openid-connect/userinfo";
        }

        public String introspectionEndpoint() {
            return issuerUri() + "/protocol/openid-connect/token/introspect";
        }

        public String oidcConfigurationEndpoint() {
            return issuerUri() + "/.well-known/openid-configuration";
        }

        public String adminUsersEndpoint() {
            return baseUrl + "/admin/realms/" + realm + "/users";
        }

        public String resolveRedirectUri(String redirectUri) {
            return StringUtils.hasText(redirectUri) ? redirectUri : defaultRedirectUri;
        }

        private static String trimTrailingSlash(String value) {
            if (value == null) {
                return null;
            }
            return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
        }
    }

    public static class Security {

        @NotBlank
        private String customerRole = "customer";

        @NotBlank
        private String corporateRole = "corporate";

        private String adminRole = "admin";

        private final List<String> ignoredRoles = new ArrayList<>(List.of("offline_access", "uma_authorization"));
        private final List<RoleDefinition> corporateSubRoles = new ArrayList<>();
        private final Cors cors = new Cors();

        public String getCustomerRole() {
            return customerRole;
        }

        public void setCustomerRole(String customerRole) {
            this.customerRole = customerRole;
        }

        public String getCorporateRole() {
            return corporateRole;
        }

        public void setCorporateRole(String corporateRole) {
            this.corporateRole = corporateRole;
        }

        public String getAdminRole() {
            return adminRole;
        }

        public void setAdminRole(String adminRole) {
            this.adminRole = adminRole;
        }

        public List<String> getIgnoredRoles() {
            return ignoredRoles;
        }

        public List<RoleDefinition> getCorporateSubRoles() {
            return corporateSubRoles;
        }

        public Cors getCors() {
            return cors;
        }
    }

    public static class Cors {

        private List<String> allowedOrigins = new ArrayList<>();

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Observability {

        private String serviceName;
        private String serviceNamespace = "voyagevibes";
        private final Telemetry telemetry = new Telemetry();

        public String getServiceName() {
            return serviceName;
        }

        public void setServiceName(String serviceName) {
            this.serviceName = serviceName;
        }

        public String getServiceNamespace() {
            return serviceNamespace;
        }

        public void setServiceNamespace(String serviceNamespace) {
            this.serviceNamespace = serviceNamespace;
        }

        public Telemetry getTelemetry() {
            return telemetry;
        }
    }

    public static class Telemetry {

        private final Trace trace = new Trace();
        private final Metrics metrics = new Metrics();
        private final Logs logs = new Logs();

        public Trace getTrace() {
            return trace;
        }

        public Metrics getMetrics() {
            return metrics;
        }

        public Logs getLogs() {
            return logs;
        }
    }

    public static class SignalExport {

        private boolean enabled;
        private String endpoint;
        private Duration timeout = Duration.ofSeconds(10);

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public Duration getTimeout() {
            return timeout;
        }

        public void setTimeout(Duration timeout) {
            this.timeout = timeout;
        }
    }

    public static class Trace extends SignalExport {
    }

    public static class Metrics extends SignalExport {

        private Duration step = Duration.ofMinutes(1);

        public Duration getStep() {
            return step;
        }

        public void setStep(Duration step) {
            this.step = step;
        }
    }

    public static class Logs extends SignalExport {

        private String transport = "http";

        public String getTransport() {
            return transport;
        }

        public void setTransport(String transport) {
            this.transport = transport;
        }
    }

    public static class Logging {

        @NotBlank
        private String filePath = "logs/authservice.log";

        public String getFilePath() {
            return filePath;
        }

        public void setFilePath(String filePath) {
            this.filePath = filePath;
        }
    }

    public static class RoleDefinition {

        @NotBlank
        private String code;

        @NotBlank
        private String displayName;

        @NotBlank
        private String description;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }
}
