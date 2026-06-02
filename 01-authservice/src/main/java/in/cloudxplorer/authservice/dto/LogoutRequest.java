package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Logout request carrying the refresh token to revoke.")
public record LogoutRequest(
        @NotBlank
        @Schema(description = "Refresh token obtained from Keycloak.", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
        String refreshToken
) {
}
