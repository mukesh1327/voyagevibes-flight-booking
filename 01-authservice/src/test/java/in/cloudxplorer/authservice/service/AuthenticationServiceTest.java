package in.cloudxplorer.authservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.cloudxplorer.authservice.client.KeycloakClient;
import in.cloudxplorer.authservice.config.AuthServiceProperties;
import in.cloudxplorer.authservice.dto.AuthCodeExchangeRequest;
import in.cloudxplorer.authservice.dto.AuthTokenResponse;
import in.cloudxplorer.authservice.dto.CustomerProfileResponse;
import in.cloudxplorer.authservice.model.KeycloakUserProfile;
import in.cloudxplorer.authservice.security.KeycloakRoleExtractor;
import in.cloudxplorer.authservice.security.UserAccessResolver;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private KeycloakClient keycloakClient;

    @Mock
    private CustomerProfileService customerProfileService;

    @Test
    void loginCustomerFallsBackToTokenSubjectWhenUserInfoSubjectIsBlank() throws Exception {
        AuthServiceProperties properties = new AuthServiceProperties();
        properties.getKeycloak().setClientId("flight-auth-service");
        properties.getKeycloak().setGoogleProviderAlias("google");
        properties.getSecurity().setCustomerRole("customer");
        properties.getSecurity().setCorporateRole("corporate");

        AuthenticationService service = new AuthenticationService(
                keycloakClient,
                new KeycloakRoleExtractor(),
                new UserAccessResolver(properties),
                customerProfileService,
                properties
        );

        String expectedSubject = "customer-123";
        String accessToken = jwt(Map.of(
                "sub", expectedSubject,
                "preferred_username", "traveler@example.com",
                "email", "traveler@example.com",
                "name", "Traveler Example",
                "given_name", "Traveler",
                "family_name", "Example",
                "email_verified", true,
                "identity_provider", "google",
                "iss", "http://localhost:8090/realms/flight-booking",
                "realm_access", Map.of("roles", Set.of("customer"))
        ));
        String idToken = jwt(Map.of(
                "sub", expectedSubject,
                "email", "traveler@example.com"
        ));

        when(keycloakClient.exchangeAuthorizationCode(any())).thenReturn(
                new KeycloakClient.TokenEndpointResponse(
                        accessToken,
                        "refresh-token",
                        idToken,
                        "Bearer",
                        300,
                        "openid profile email"
                )
        );
        when(keycloakClient.fetchUserInfo(accessToken)).thenReturn(Map.of(
                "sub", "   ",
                "email", "traveler@example.com",
                "identity_provider", "google"
        ));

        CustomerProfileResponse profileResponse = new CustomerProfileResponse(
                expectedSubject,
                "traveler@example.com",
                "Traveler Example",
                "google",
                Instant.parse("2026-05-10T00:00:00Z"),
                Instant.parse("2026-05-10T00:00:00Z")
        );
        when(customerProfileService.upsert(any())).thenReturn(new CustomerProfileService.UpsertResult(profileResponse, true));

        AuthTokenResponse response = service.loginCustomer(new AuthCodeExchangeRequest("auth-code", "http://localhost:3000/callback", "verifier"));

        ArgumentCaptor<KeycloakUserProfile> profileCaptor = ArgumentCaptor.forClass(KeycloakUserProfile.class);
        org.mockito.Mockito.verify(customerProfileService).upsert(profileCaptor.capture());

        assertThat(profileCaptor.getValue().subject()).isEqualTo(expectedSubject);
        assertThat(response.user().subject()).isEqualTo(expectedSubject);
    }

    private static String jwt(Map<String, Object> claims) throws Exception {
        String header = base64Url("{\"alg\":\"none\",\"typ\":\"JWT\"}");
        String payload = base64Url(OBJECT_MAPPER.writeValueAsString(claims));
        return header + "." + payload + ".signature";
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
