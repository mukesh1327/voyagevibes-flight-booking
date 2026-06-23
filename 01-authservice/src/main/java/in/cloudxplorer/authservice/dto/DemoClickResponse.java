package in.cloudxplorer.authservice.dto;

import java.time.Instant;
import java.util.UUID;

public record DemoClickResponse(
        UUID eventId,
        String sessionId,
        String buttonName,
        String traceId,
        String spanId,
        long totalEvents,
        Instant createdAt,
        String message
) {
}
