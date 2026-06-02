package in.cloudxplorer.authservice.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(description = "User details resolved from the validated JWT token.")
public record AuthenticatedUserResponse(
        @Schema(example = "0f08f10a-31fc-40ae-b2ec-44c9442da7c2")
        String subject,

        @Schema(example = "traveler@example.com")
        String username,

        @Schema(example = "traveler@example.com")
        String email,

        @Schema(example = "Ananya Rao")
        String fullName,

        @ArraySchema(schema = @Schema(example = "customer"))
        Set<String> roles,

        @Schema(example = "customer")
        String baseRole,

        @ArraySchema(schema = @Schema(example = "support-desk"))
        Set<String> corporateRoles,

        @Schema(example = "CUSTOMER")
        String userType,

        @Schema(example = "google")
        String identityProvider,

        @Schema(example = "http://localhost:8080/realms/flight-booking")
        String issuer,

        @Schema(example = "true")
        boolean active
) {
}
