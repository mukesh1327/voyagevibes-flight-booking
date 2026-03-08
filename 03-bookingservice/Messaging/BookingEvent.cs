namespace bookingservice.Messaging;

public record BookingEvent(
    string EventId,
    string EventType,
    string OccurredAt,
    string BookingId,
    string HoldId,
    string FlightId,
    int SeatCount,
    string UserId,
    string ActorType);
