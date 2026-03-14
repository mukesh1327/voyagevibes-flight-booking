namespace bookingservice.Domain;

public record IdempotencyRecord(
    string Key,
    string Scope,
    string RequestHash,
    string ResponsePayload,
    DateTimeOffset CreatedAt);
