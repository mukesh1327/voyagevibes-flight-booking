package in.cloudxplorer.authservice.web;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(description = "Service health response.")
public record HealthResponse(
        @Schema(example = "UP")
        String status,

        @Schema(example = "authservice")
        String service,

        @Schema(example = "8081")
        int port,

        @Schema(example = "true")
        boolean operational,

        @Schema(description = "Connectivity status of required dependencies.")
        Map<String, String> components
) {
}
