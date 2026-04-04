namespace bookingservice.Messaging;

public record InventoryEvent(
    string EventId,
    string EventType,
    string OccurredAt,
    string FlightId,
    string HoldId,
    string BookingId,
    int SeatCount,
    string ActorType,
    string UserId,
    string Status,
    string Reason,
    string Source);
