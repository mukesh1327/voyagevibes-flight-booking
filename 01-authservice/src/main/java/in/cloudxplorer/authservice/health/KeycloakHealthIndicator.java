package in.cloudxplorer.authservice.health;

import in.cloudxplorer.authservice.config.AuthServiceProperties;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component("keycloak")
public class KeycloakHealthIndicator implements HealthIndicator {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakHealthIndicator.class);

    private final RestClient restClient;
    private final AuthServiceProperties properties;

    public KeycloakHealthIndicator(RestClient keycloakRestClient, AuthServiceProperties properties) {
        this.restClient = keycloakRestClient;
        this.properties = properties;
    }

    @Override
    public Health health() {
        try {
            String endpoint = properties.getKeycloak().oidcConfigurationEndpoint();
            Map<String, Object> metadata = restClient.get()
                    .uri(Objects.requireNonNull(endpoint))
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            Health health = Health.up()
                    .withDetail("realm", properties.getKeycloak().getRealm())
                    .withDetail("baseUrl", properties.getKeycloak().getBaseUrl())
                    .withDetail("issuer", metadata == null ? properties.getKeycloak().issuerUri() : metadata.get("issuer"))
                    .build();
            logger.info("🔍 Keycloak Health Check: ✅ UP - Realm: {}, Issuer: {}", properties.getKeycloak().getRealm(), metadata == null ? properties.getKeycloak().issuerUri() : metadata.get("issuer"));
            return health;
        } catch (RestClientResponseException ex) {
            Health health = Health.down(ex)
                    .withDetail("realm", properties.getKeycloak().getRealm())
                    .withDetail("baseUrl", properties.getKeycloak().getBaseUrl())
                    .withDetail("oidcConfiguration", properties.getKeycloak().oidcConfigurationEndpoint())
                    .withDetail("statusCode", ex.getStatusCode().value())
                    .withDetail("responseBody", trimToSingleLine(ex.getResponseBodyAsString()))
                    .build();
            logger.warn("🔍 Keycloak Health Check: ❌ DOWN - Realm: {}, Error: {} {}", properties.getKeycloak().getRealm(), ex.getStatusCode().value(), ex.getStatusText());
            return health;
        } catch (Exception ex) {
            Health health = Health.down(ex)
                    .withDetail("realm", properties.getKeycloak().getRealm())
                    .withDetail("baseUrl", properties.getKeycloak().getBaseUrl())
                    .withDetail("oidcConfiguration", properties.getKeycloak().oidcConfigurationEndpoint())
                    .build();
            logger.warn("🔍 Keycloak Health Check: ❌ DOWN - Realm: {}, Error: {}", properties.getKeycloak().getRealm(), ex.getMessage());
            return health;
        }
    }

    private String trimToSingleLine(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replace('\n', ' ').replace('\r', ' ').trim();
        return normalized.length() > 200 ? normalized.substring(0, 200) : normalized;
    }
}
