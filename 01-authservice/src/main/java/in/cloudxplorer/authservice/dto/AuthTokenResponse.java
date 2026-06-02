package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Token exchange result returned after successful Keycloak authentication.")
public record AuthTokenResponse(
        @Schema(example = "Bearer")
        String tokenType,

        @Schema(example = "3600")
        long expiresIn,

        @Schema(example = "openid profile email")
        String scope,

        @Schema(example = "CUSTOMER")
        String userType,

        @Schema(example = "true")
        boolean newlyRegistered,

        @Schema(example = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...")
        String accessToken,

        @Schema(example = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...")
        String refreshToken,

        @Schema(example = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...")
        String idToken,

        AuthenticatedUserResponse user,

        CustomerProfileResponse customerProfile
) {
}
