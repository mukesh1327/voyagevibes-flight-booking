package in.cloudxplorer.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DemoClickRequest(
        @NotBlank
        @Size(max = 80)
        String sessionId,

        @NotBlank
        @Size(max = 120)
        String buttonName
) {
}
