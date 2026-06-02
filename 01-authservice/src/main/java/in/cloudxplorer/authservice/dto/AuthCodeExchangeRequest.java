package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Authorization code exchange request.")
public record AuthCodeExchangeRequest(
        @NotBlank
        @Schema(description = "Authorization code returned by Keycloak.", example = "7f9efdf8-2608-45f7-b5a9-b5547e0987d4.a8290f55-f65f-451e-a27c-50eb63141f4a.71df42a0-c9c8-4136-8d64-f9bdfb25d79c")
        String authorizationCode,

        @Schema(
                description = "Redirect URI used in the authorization request. When omitted, the service falls back to app.keycloak.default-redirect-uri for Swagger or local testing flows.",
                example = "http://localhost:8081/swagger-ui/oauth2-redirect.html"
        )
        String redirectUri,

        @Schema(description = "PKCE code verifier when the client uses PKCE.", example = "53NfA0fU5I8bI8g_w0EN16Qv7Tm2s5NNv4Xf0Y18iQw")
        String codeVerifier
) {
}
