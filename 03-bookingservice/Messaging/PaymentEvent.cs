namespace bookingservice.Messaging;

public record PaymentEvent(
    string EventId,
    string EventType,
    string OccurredAt,
    string PaymentId,
    string BookingId,
    int Amount,
    string Currency,
    string Status,
    string UserId,
    string ActorType,
    string Source);
