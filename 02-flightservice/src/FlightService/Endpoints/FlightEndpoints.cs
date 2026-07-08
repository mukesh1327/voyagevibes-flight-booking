using Microsoft.EntityFrameworkCore;

namespace FlightService.Endpoints;

public static class FlightEndpoints
{
    public static IEndpointRouteBuilder MapFlightEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "UP", service = "flight-service" }));
        app.MapGet("/flights/health", () => Results.Ok(new { status = "UP", service = "flight-service" }));

        app.MapGet("/flights/search", async (
            string from,
            string to,
            DateOnly date,
            string? sort,
            FlightSearchService service,
            CancellationToken cancellationToken) =>
        {
            if (!FlightSearchService.IsValidAirportCode(from) || !FlightSearchService.IsValidAirportCode(to))
            {
                return Results.BadRequest(new { message = "from and to must be 3-letter airport codes" });
            }

            var results = await service.SearchAsync(from, to, date, sort, cancellationToken);
            return Results.Ok(results);
        });

        app.MapGet("/flights/{id:guid}", async (Guid id, FlightDbContext db, CancellationToken cancellationToken) =>
        {
            var flight = await db.Flights.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            return flight is null ? Results.NotFound() : Results.Ok(FlightDto.From(flight));
        });

        app.MapPatch("/flights/{id:guid}", async (
            Guid id,
            FlightUpdateRequest request,
            HttpRequest httpRequest,
            FlightDbContext db,
            CancellationToken cancellationToken) =>
        {
            if (!HasAnyRole(httpRequest, "flight-admin", "platform-admin", "super-admin"))
            {
                return Results.Json(new { message = "flight-admin role is required" }, statusCode: StatusCodes.Status403Forbidden);
            }

            var validationError = request.Validate();
            if (validationError is not null)
            {
                return Results.BadRequest(new { message = validationError });
            }

            var flight = await db.Flights.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (flight is null)
            {
                return Results.NotFound(new { message = "Flight not found" });
            }

            request.ApplyTo(flight);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(FlightDto.From(flight));
        });

        app.MapPost("/flights/{id:guid}/hold", async (
            Guid id,
            FlightHoldRequest request,
            FlightSearchService service,
            CancellationToken cancellationToken) =>
        {
            if (!FlightSearchService.IsValidSeatCount(request.Seats))
            {
                return Results.BadRequest(new { message = "seats must be between 1 and 6" });
            }

            var hold = await service.HoldAsync(id, request.Seats, cancellationToken);
            return hold is null
                ? Results.Conflict(new { message = "Flight is sold out or no longer available" })
                : Results.Ok(hold);
        });

        return app;
    }

    private static bool HasAnyRole(HttpRequest request, params string[] allowedRoles)
    {
        var roles = request.Headers["x-user-roles"]
            .SelectMany(value => value?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [])
            .Select(role => role.ToLowerInvariant())
            .ToHashSet();

        return allowedRoles.Any(role => roles.Contains(role));
    }
}

public sealed record FlightUpdateRequest(
    string? FlightNo,
    string? Origin,
    string? Destination,
    DateTime? DepartureTime,
    DateTime? ArrivalTime,
    decimal? Price,
    int? SeatsAvailable)
{
    public string? Validate()
    {
        if (Origin is not null && !FlightSearchService.IsValidAirportCode(Origin))
        {
            return "origin must be a 3-letter airport code";
        }
        if (Destination is not null && !FlightSearchService.IsValidAirportCode(Destination))
        {
            return "destination must be a 3-letter airport code";
        }
        if (Price is <= 0)
        {
            return "price must be greater than zero";
        }
        if (SeatsAvailable is < 0)
        {
            return "seatsAvailable cannot be negative";
        }
        if (DepartureTime.HasValue && ArrivalTime.HasValue && ArrivalTime <= DepartureTime)
        {
            return "arrivalTime must be after departureTime";
        }

        return null;
    }

    public void ApplyTo(Flight flight)
    {
        // Flight admins handle route, timing, fare, and inventory corrections from the employee portal.
        flight.FlightNo = string.IsNullOrWhiteSpace(FlightNo) ? flight.FlightNo : FlightNo.Trim().ToUpperInvariant();
        flight.Origin = Origin is null ? flight.Origin : Origin.Trim().ToUpperInvariant();
        flight.Destination = Destination is null ? flight.Destination : Destination.Trim().ToUpperInvariant();
        flight.DepartureTime = DepartureTime ?? flight.DepartureTime;
        flight.ArrivalTime = ArrivalTime ?? flight.ArrivalTime;
        flight.Price = Price ?? flight.Price;
        flight.SeatsAvailable = SeatsAvailable ?? flight.SeatsAvailable;
    }
}
