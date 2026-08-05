namespace FlightService;

public static class HoldStatus
{
    public const string Active = "ACTIVE";
    public const string Confirmed = "CONFIRMED";
    public const string Released = "RELEASED";
    public const string Cancelled = "CANCELLED";
}

public sealed class FlightHold
{
    public Guid Id { get; set; }
    public Guid FlightId { get; set; }
    public int SeatsHeld { get; set; }
    public string Status { get; set; } = HoldStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

public enum HoldTransitionResult
{
    Applied,
    AlreadyInState,
    Conflict,
    NotFound,
}
