using Microsoft.EntityFrameworkCore;

namespace FlightService;

public sealed class FlightSearchService(FlightDbContext db)
{
    private static readonly HashSet<string> SupportedSorts = ["price", "departure"];
    private static readonly TimeSpan HoldWindow = TimeSpan.FromMinutes(10);

    public async Task<IReadOnlyList<FlightDto>> SearchAsync(
        string from,
        string to,
        DateOnly date,
        string? sort,
        CancellationToken cancellationToken)
    {
        var origin = NormalizeAirport(from);
        var destination = NormalizeAirport(to);
        var sortKey = SupportedSorts.Contains(sort?.ToLowerInvariant() ?? "price")
            ? sort?.ToLowerInvariant()
            : "price";
        var start = date.ToDateTime(TimeOnly.MinValue);
        var end = date.AddDays(1).ToDateTime(TimeOnly.MinValue);

        IQueryable<Flight> query = db.Flights.AsNoTracking()
            .Where(flight =>
                flight.Origin == origin &&
                flight.Destination == destination &&
                flight.DepartureTime >= start &&
                flight.DepartureTime < end &&
                flight.SeatsAvailable > 0);

        query = sortKey switch
        {
            "departure" => query.OrderBy(flight => flight.DepartureTime).ThenBy(flight => flight.Price),
            _ => query.OrderBy(flight => flight.Price).ThenBy(flight => flight.DepartureTime),
        };

        var flights = await query.ToListAsync(cancellationToken);
        return flights.Select(FlightDto.From).ToList();
    }

    public async Task<FlightHoldResponse?> HoldAsync(Guid flightId, int seats, CancellationToken cancellationToken)
    {
        var updated = await db.Flights
            .Where(flight => flight.Id == flightId && flight.SeatsAvailable >= seats)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(flight => flight.SeatsAvailable, flight => flight.SeatsAvailable - seats), cancellationToken);

        if (updated == 0)
        {
            return null;
        }

        var flight = await db.Flights.AsNoTracking().FirstAsync(flight => flight.Id == flightId, cancellationToken);

        // The hold is persisted so an unconfirmed checkout can be reclaimed later by HoldSweepService
        // instead of leaking the decremented seats forever.
        var now = DateTimeOffset.UtcNow;
        var hold = new FlightHold
        {
            Id = Guid.NewGuid(),
            FlightId = flight.Id,
            SeatsHeld = seats,
            Status = HoldStatus.Active,
            CreatedAt = now,
            ExpiresAt = now.Add(HoldWindow),
        };
        db.Holds.Add(hold);
        await db.SaveChangesAsync(cancellationToken);

        return new FlightHoldResponse(
            hold.Id.ToString("N"),
            flight.Id,
            flight.FlightNo,
            flight.Price,
            seats,
            flight.SeatsAvailable,
            hold.ExpiresAt);
    }

    public async Task<HoldTransitionResult> ConfirmHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        var claimed = await db.Holds
            .Where(hold => hold.Id == holdId && hold.Status == HoldStatus.Active)
            .ExecuteUpdateAsync(updates => updates.SetProperty(hold => hold.Status, HoldStatus.Confirmed), cancellationToken);

        if (claimed == 1)
        {
            return HoldTransitionResult.Applied;
        }

        var hold = await db.Holds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == holdId, cancellationToken);
        if (hold is null)
        {
            return HoldTransitionResult.NotFound;
        }

        return hold.Status == HoldStatus.Confirmed ? HoldTransitionResult.AlreadyInState : HoldTransitionResult.Conflict;
    }

    public async Task<HoldTransitionResult> ReleaseHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        // Claim the transition atomically first so a concurrent release (from the sweep and an
        // explicit call racing each other) can never credit the seats back twice.
        var claimed = await db.Holds
            .Where(hold => hold.Id == holdId && hold.Status == HoldStatus.Active)
            .ExecuteUpdateAsync(updates => updates.SetProperty(hold => hold.Status, HoldStatus.Released), cancellationToken);

        if (claimed == 1)
        {
            var hold = await db.Holds.AsNoTracking().FirstAsync(item => item.Id == holdId, cancellationToken);
            await db.Flights
                .Where(flight => flight.Id == hold.FlightId)
                .ExecuteUpdateAsync(updates => updates
                    .SetProperty(flight => flight.SeatsAvailable, flight => flight.SeatsAvailable + hold.SeatsHeld), cancellationToken);
            return HoldTransitionResult.Applied;
        }

        var existing = await db.Holds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == holdId, cancellationToken);
        if (existing is null)
        {
            return HoldTransitionResult.NotFound;
        }

        return existing.Status == HoldStatus.Released ? HoldTransitionResult.AlreadyInState : HoldTransitionResult.Conflict;
    }

    /// <summary>
    /// Explicit user-initiated cancellation. Unlike ReleaseHoldAsync, this is allowed from
    /// CONFIRMED too, since cancelling a paid booking is expected to give the seats back.
    /// </summary>
    public async Task<HoldTransitionResult> CancelHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        var claimed = await db.Holds
            .Where(hold => hold.Id == holdId && (hold.Status == HoldStatus.Active || hold.Status == HoldStatus.Confirmed))
            .ExecuteUpdateAsync(updates => updates.SetProperty(hold => hold.Status, HoldStatus.Cancelled), cancellationToken);

        if (claimed == 1)
        {
            var hold = await db.Holds.AsNoTracking().FirstAsync(item => item.Id == holdId, cancellationToken);
            await db.Flights
                .Where(flight => flight.Id == hold.FlightId)
                .ExecuteUpdateAsync(updates => updates
                    .SetProperty(flight => flight.SeatsAvailable, flight => flight.SeatsAvailable + hold.SeatsHeld), cancellationToken);
            return HoldTransitionResult.Applied;
        }

        var existing2 = await db.Holds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == holdId, cancellationToken);
        if (existing2 is null)
        {
            return HoldTransitionResult.NotFound;
        }

        return existing2.Status == HoldStatus.Cancelled ? HoldTransitionResult.AlreadyInState : HoldTransitionResult.Conflict;
    }

    public static bool IsValidAirportCode(string value) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Trim().Length == 3 &&
        value.Trim().All(char.IsLetter);

    public static bool IsValidSeatCount(int seats) => seats is >= 1 and <= 6;

    private static string NormalizeAirport(string value) => value.Trim().ToUpperInvariant();
}
