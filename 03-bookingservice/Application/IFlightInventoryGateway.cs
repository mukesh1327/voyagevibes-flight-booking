using bookingservice.Domain;

namespace bookingservice.Application;

public interface IFlightInventoryGateway
{
    Task<FlightInventoryResult> HoldAsync(string bookingId, string flightId, int seatCount, ActorType actorType, string userId, string correlationId, CancellationToken cancellationToken = default);
    Task<FlightInventoryResult> CommitAsync(string bookingId, string holdId, ActorType actorType, string userId, string correlationId, CancellationToken cancellationToken = default);
    Task<FlightInventoryResult> ReleaseAsync(string bookingId, string holdId, ActorType actorType, string userId, string correlationId, CancellationToken cancellationToken = default);
}

public record FlightInventoryResult(string HoldId, string Status);
