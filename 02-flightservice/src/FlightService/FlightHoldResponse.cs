namespace FlightService;

public sealed record FlightHoldResponse(
    string HoldId,
    Guid FlightId,
    string FlightNo,
    decimal Price,
    int SeatsHeld,
    int SeatsRemaining,
    DateTimeOffset ExpiresAt);
