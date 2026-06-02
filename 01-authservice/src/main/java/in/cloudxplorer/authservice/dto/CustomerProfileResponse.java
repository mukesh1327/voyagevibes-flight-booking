package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Minimal customer metadata stored locally by the service.")
public record CustomerProfileResponse(
        @Schema(example = "0f08f10a-31fc-40ae-b2ec-44c9442da7c2")
        String keycloakUserId,

        @Schema(example = "traveler@example.com")
        String email,

        @Schema(example = "Ananya Rao")
        String fullName,

        @Schema(example = "google")
        String identityProvider,

        @Schema(example = "2026-05-02T06:30:00Z")
        Instant createdAt,

        @Schema(example = "2026-05-02T06:35:00Z")
        Instant updatedAt
) {
}
