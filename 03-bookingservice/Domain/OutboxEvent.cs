namespace bookingservice.Domain;

public record OutboxEvent(
    string EventId,
    string EventType,
    string BookingId,
    string Payload,
    DateTimeOffset CreatedAt,
    int PublishAttempts);
