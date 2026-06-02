package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

@Schema(description = "Public configuration that helps frontends start Keycloak login flows consistently.")
public record AuthFrontendConfigResponse(
        @Schema(example = "flight-booking")
        String realm,

        @Schema(example = "https://keycloak.voyagevibes.in:8091/realms/flight-booking")
        String issuer,

        @Schema(example = "flight-auth-service")
        String clientId,

        @Schema(example = "https://keycloak.voyagevibes.in:8091/realms/flight-booking/protocol/openid-connect/auth")
        String authorizationEndpoint,

        @Schema(example = "https://keycloak.voyagevibes.in:8091/realms/flight-booking/protocol/openid-connect/token")
        String tokenEndpoint,

        @Schema(example = "https://keycloak.voyagevibes.in:8091/realms/flight-booking/protocol/openid-connect/logout")
        String logoutEndpoint,

        @Schema(example = "http://localhost:8081/swagger-ui/oauth2-redirect.html")
        String defaultRedirectUri,

        @Schema(example = "openid profile email")
        String scope,

        @Schema(example = "code")
        String responseType,

        @Schema(example = "true")
        boolean pkceRequired,

        @Schema(example = "S256")
        String codeChallengeMethod,

        LoginFlowConfig customer,

        LoginFlowConfig corporate,

        @ArraySchema(schema = @Schema(implementation = CorporateRoleDescriptor.class))
        List<CorporateRoleDescriptor> corporateRoleCatalog
) {
    @Schema(description = "Per-audience login flow details for frontend applications.")
    public record LoginFlowConfig(
            @Schema(example = "customer")
            String audience,

            @Schema(example = "/auth/customer/login")
            String exchangeEndpoint,

            @Schema(example = "/auth/customer/register")
            String registrationEndpoint,

            @Schema(example = "customer")
            String requiredBaseRole,

            @Schema(example = "google")
            String identityProviderHint,

            @Schema(example = "true")
            boolean supportsSelfRegistration,

            Map<String, String> authorizationParameters
    ) {
    }

    @Schema(description = "Corporate role metadata for UI navigation and feature toggles. Downstream APIs must still enforce authorization.")
    public record CorporateRoleDescriptor(
            @Schema(example = "support-desk")
            String code,

            @Schema(example = "Support Desk")
            String displayName,

            @Schema(example = "Workforce agents handling payment, refund, and booking support queries.")
            String description
    ) {
    }
}
