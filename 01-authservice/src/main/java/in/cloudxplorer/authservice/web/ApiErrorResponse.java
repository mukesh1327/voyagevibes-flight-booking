package in.cloudxplorer.authservice.web;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Standard API error response.")
public record ApiErrorResponse(
        @Schema(example = "2026-05-02T06:45:00Z")
        Instant timestamp,

        @Schema(example = "401")
        int status,

        @Schema(example = "Unauthorized")
        String error,

        @Schema(example = "The provided authorization code is invalid or expired.")
        String message,

        @Schema(example = "/auth/customer/login")
        String path
) {
}
