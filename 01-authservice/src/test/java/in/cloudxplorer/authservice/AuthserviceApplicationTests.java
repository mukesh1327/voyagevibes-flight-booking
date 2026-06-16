package in.cloudxplorer.authservice;

import in.cloudxplorer.authservice.config.AuthServiceProperties;
import in.cloudxplorer.authservice.health.KeycloakHealthIndicator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureObservability
class AuthserviceApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AuthServiceProperties properties;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@MockBean
	private KeycloakHealthIndicator keycloakHealthIndicator;

	// Test configuration properties from environment variables
	private String customerUserId;
	private String customerEmail;
	private String customerUsername;
	private String corporateUserId;
	private String corporateEmail;
	private String corporateUsername;
	private String keycloakIssuer;
	private String realm;
	private String keycloakBaseUrl;
	private String identityProviderHint;
	private String customerRole;
	private String corporateRole;

	@BeforeEach
	void setUp() {
		// Load test properties from environment variables with defaults
		customerUserId = System.getenv().getOrDefault("TEST_CUSTOMER_ID", "customer-123");
		customerEmail = System.getenv().getOrDefault("TEST_CUSTOMER_EMAIL", "traveler@example.com");
		customerUsername = System.getenv().getOrDefault("TEST_CUSTOMER_USERNAME", "traveler@example.com");
		corporateUserId = System.getenv().getOrDefault("TEST_CORPORATE_ID", "corp-123");
		corporateEmail = System.getenv().getOrDefault("TEST_CORPORATE_EMAIL", "support@voyagevibes.in");
		corporateUsername = System.getenv().getOrDefault("TEST_CORPORATE_USERNAME", "support@voyagevibes.in");
		keycloakIssuer = System.getenv().getOrDefault("TEST_KEYCLOAK_ISSUER", "http://localhost:8080/realms/flight-booking");
		realm = System.getenv().getOrDefault("TEST_REALM", "flight-booking");
		keycloakBaseUrl = System.getenv().getOrDefault("TEST_KEYCLOAK_BASE_URL", "http://localhost:8090");
		identityProviderHint = System.getenv().getOrDefault("TEST_IDP_HINT", "google");
		customerRole = System.getenv().getOrDefault("TEST_CUSTOMER_ROLE", "customer");
		corporateRole = System.getenv().getOrDefault("TEST_CORPORATE_ROLE", "corporate");

		doReturn(Health.up().withDetail("issuer", "http://localhost").build())
				.when(keycloakHealthIndicator).health();
	}

	@Test
	void contextLoads() {
	}

	@Test
	void healthEndpointIsPublic() throws Exception {
		mockMvc.perform(get("/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"))
				.andExpect(jsonPath("$.operational").value(true))
				.andExpect(jsonPath("$.components.db").value("UP"))
				.andExpect(jsonPath("$.components.keycloak").value("UP"));
	}

	@Test
	void healthEndpointReturnsServiceUnavailableWhenKeycloakIsDown() throws Exception {
		doReturn(Health.down().withDetail("error", "timeout").build())
				.when(keycloakHealthIndicator).health();

		mockMvc.perform(get("/health"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.status").value("DOWN"))
				.andExpect(jsonPath("$.operational").value(false))
				.andExpect(jsonPath("$.components.keycloak").value("DOWN"));
	}

	@Test
	void docsRouteRedirectsToCustomerSwaggerGroup() throws Exception {
		mockMvc.perform(get("/docs"))
				.andExpect(status().is3xxRedirection())
				.andExpect(redirectedUrl("/docs/customer"));
	}

	@Test
	void customerDocsRouteRedirectsToGroupedSwaggerUi() throws Exception {
		mockMvc.perform(get("/docs/customer"))
				.andExpect(status().is3xxRedirection())
				.andExpect(redirectedUrl("/swagger-ui/index.html?urls.primaryName=customer"));
	}

	@Test
	void frontendConfigIsPublicAndContainsCustomerAndCorporateFlows() throws Exception {
		mockMvc.perform(get("/auth/frontend-config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.realm").value(realm))
				.andExpect(jsonPath("$.customer.requiredBaseRole").value(customerRole))
				.andExpect(jsonPath("$.customer.identityProviderHint").value(identityProviderHint))
				.andExpect(jsonPath("$.corporate.requiredBaseRole").value(corporateRole));
	}

	@Test
	void syntheticErrorRateEndpointCanReturnSuccess() throws Exception {
		mockMvc.perform(get("/auth/test/error-rate")
						.param("failureRatePercent", "0")
						.param("sample", "99"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.failed").value(false))
				.andExpect(jsonPath("$.failureRatePercent").value(0))
				.andExpect(jsonPath("$.sample").value(99))
				.andExpect(jsonPath("$.message").value("Synthetic request succeeded"));
	}

	@Test
	void syntheticErrorRateEndpointCanReturnSyntheticFailure() throws Exception {
		mockMvc.perform(get("/auth/test/error-rate")
						.param("failureRatePercent", "100")
						.param("sample", "0"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.status").value(503))
				.andExpect(jsonPath("$.message").value("Synthetic failure for error-rate testing"))
				.andExpect(jsonPath("$.path").value("/auth/test/error-rate"));
	}

	@Test
	void meEndpointRequiresAuthentication() throws Exception {
		mockMvc.perform(get("/auth/me"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	@SuppressWarnings("unchecked")
	void meEndpointReturnsJwtClaimsWhenAuthenticated() throws Exception {
		mockMvc.perform(get("/auth/me")
					.with(SecurityMockMvcRequestPostProcessors.jwt()
							.jwt(jwt -> jwt
									.claim("sub", customerUserId)
									.claim("preferred_username", customerUsername)
									.claim("email", customerEmail)
									.claim("name", "Traveler Example")
									.claim("iss", keycloakIssuer)
									.claim("realm_access", Map.of("roles", List.of(customerRole))))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.subject").value(customerUserId))
			.andExpect(jsonPath("$.baseRole").value(customerRole))
			.andExpect(jsonPath("$.userType").value("CUSTOMER"));
	}

	@Test
	@SuppressWarnings("unchecked")
	void meEndpointReturnsCorporateSubRolesWithoutPlatformRoles() throws Exception {
		mockMvc.perform(get("/auth/me")
					.with(SecurityMockMvcRequestPostProcessors.jwt()
							.jwt(jwt -> jwt
									.claim("sub", corporateUserId)
									.claim("preferred_username", corporateUsername)
									.claim("email", corporateEmail)
									.claim("name", "Support Agent")
									.claim("iss", keycloakIssuer)
									.claim("realm_access", Map.of("roles", List.of(corporateRole, "support-desk", "offline_access"))))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.baseRole").value(corporateRole))
			.andExpect(jsonPath("$.userType").value("CORPORATE"))
			.andExpect(jsonPath("$.corporateRoles[0]").value("support-desk"));
	}

	@Test
	void observabilityAndLoggingDefaultsAreBoundFromAppProperties() {
		org.assertj.core.api.Assertions.assertThat(properties.getObservability().getServiceName()).isEqualTo("authservice");
		org.assertj.core.api.Assertions.assertThat(properties.getObservability().getTelemetry().getTrace().isEnabled()).isFalse();
		org.assertj.core.api.Assertions.assertThat(properties.getObservability().getTelemetry().getMetrics().isEnabled()).isFalse();
		org.assertj.core.api.Assertions.assertThat(properties.getObservability().getTelemetry().getLogs().isEnabled()).isFalse();
		org.assertj.core.api.Assertions.assertThat(properties.getLogging().getFilePath()).isEqualTo("logs/authservice.log");
		org.assertj.core.api.Assertions.assertThat(properties.getKeycloak().getBaseUrl()).isEqualTo(keycloakBaseUrl);
	}

	@Test
	void customerProfilesTableAndEmailIndexAreCreatedByFlyway() {
		Integer tableCount = jdbcTemplate.queryForObject(
				"""
				select count(*)
				from information_schema.tables
				where table_name = 'CUSTOMER_PROFILES'
				""",
				Integer.class
		);
		Integer indexCount = jdbcTemplate.queryForObject(
				"""
				select count(*)
				from information_schema.indexes
				where table_name = 'CUSTOMER_PROFILES'
				  and index_name = 'IDX_CUSTOMER_PROFILES_EMAIL'
				""",
				Integer.class
		);

		org.assertj.core.api.Assertions.assertThat(tableCount).isEqualTo(1);
		org.assertj.core.api.Assertions.assertThat(indexCount).isEqualTo(1);
	}

}
