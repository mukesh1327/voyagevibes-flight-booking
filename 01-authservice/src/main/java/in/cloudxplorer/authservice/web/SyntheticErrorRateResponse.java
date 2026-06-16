package in.cloudxplorer.authservice.web;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Synthetic response used to test error-rate monitoring and alerting.")
public record SyntheticErrorRateResponse(
        @Schema(example = "2026-06-14T10:15:30Z")
        Instant timestamp,

        @Schema(example = "false")
        boolean failed,

        @Schema(example = "20")
        int failureRatePercent,

        @Schema(example = "36")
        int sample,

        @Schema(example = "Synthetic request succeeded")
        String message
) {
}
