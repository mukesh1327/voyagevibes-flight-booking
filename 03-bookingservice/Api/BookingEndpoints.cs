using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using bookingservice.Application;
using bookingservice.Domain;

namespace bookingservice.Api;

public static class BookingEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/bookings")
            .WithTags("Bookings");

        group.MapPost("/reserve", (HttpRequest request, ReserveBookingRequest payload, BookingApplicationService service, IIdempotencyStore idempotencyStore, CancellationToken cancellationToken) =>
        {
            var userId = RequestContext.UserId(request);
            var actorType = RequestContext.ActorType(request);
            var payloadJson = JsonSerializer.Serialize(payload, JsonOptions);
            var requestHash = ComputeRequestHash("reserve", userId, actorType, payloadJson);
            return ExecuteAsyncWithIdempotency(
                request,
                idempotencyStore,
                "reserve",
                requestHash,
                () => service.ReserveAsync(
                    userId,
                    actorType,
                    payload,
                    RequestContext.CorrelationId(request),
                    cancellationToken));
        })
        .WithName("ReserveBooking")
        .WithSummary("Reserve seats for a flight")
        .WithDescription("Creates a booking in RESERVED state and places an inventory hold with the flight service.")
        .Accepts<ReserveBookingRequest>("application/json")
        .Produces<Booking>(StatusCodes.Status200OK)
        .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
        .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
        .WithRequestContextHeaders(includeIdempotencyHeaders: true);

        group.MapPost("/{bookingId}/confirm", (HttpRequest request, string bookingId, BookingApplicationService service, IIdempotencyStore idempotencyStore, CancellationToken cancellationToken) =>
        {
            var userId = RequestContext.UserId(request);
            var actorType = RequestContext.ActorType(request);
            var payloadJson = JsonSerializer.Serialize(new { bookingId }, JsonOptions);
            var requestHash = ComputeRequestHash("confirm", userId, actorType, payloadJson);
            return ExecuteAsyncWithIdempotency(
                request,
                idempotencyStore,
                "confirm",
                requestHash,
                () => service.ConfirmAsync(
                    bookingId,
                    userId,
                    actorType,
                    RequestContext.CorrelationId(request),
                    cancellationToken));
        })
        .WithName("ConfirmBooking")
        .WithSummary("Confirm a booking")
        .WithDescription("Commits the existing inventory hold and marks the booking as CONFIRMED.")
        .Produces<Booking>(StatusCodes.Status200OK)
        .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
        .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
        .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
        .WithRequestContextHeaders(includeIdempotencyHeaders: true);

        group.MapGet("/{bookingId}", (HttpRequest request, string bookingId, BookingApplicationService service) =>
        {
            return Execute(() => service.GetOne(bookingId, RequestContext.UserId(request), RequestContext.ActorType(request)));
        })
        .WithName("GetBooking")
        .WithSummary("Get a booking by ID")
        .WithDescription("Returns a single booking when the caller is allowed to access it.")
        .Produces<Booking>(StatusCodes.Status200OK)
        .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
        .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
        .WithRequestContextHeaders();

        group.MapGet("", (HttpRequest request, BookingApplicationService service) =>
        {
            return Results.Ok(service.GetMany(RequestContext.UserId(request), RequestContext.ActorType(request)));
        })
        .WithName("ListBookings")
        .WithSummary("List bookings for the caller")
        .WithDescription("Returns all bookings for the current user, or every booking for corp actors.")
        .Produces<BookingListResponse>(StatusCodes.Status200OK)
        .WithRequestContextHeaders();

        group.MapPost("/{bookingId}/cancel", (HttpRequest request, string bookingId, BookingApplicationService service, IIdempotencyStore idempotencyStore, CancellationToken cancellationToken) =>
        {
            var userId = RequestContext.UserId(request);
            var actorType = RequestContext.ActorType(request);
            var payloadJson = JsonSerializer.Serialize(new { bookingId }, JsonOptions);
            var requestHash = ComputeRequestHash("cancel", userId, actorType, payloadJson);
            return ExecuteAsyncWithIdempotency(
                request,
                idempotencyStore,
                "cancel",
                requestHash,
                () => service.CancelAsync(
                    bookingId,
                    userId,
                    actorType,
                    RequestContext.CorrelationId(request),
                    cancellationToken));
        })
        .WithName("CancelBooking")
        .WithSummary("Cancel a booking")
        .WithDescription("Releases the inventory hold and marks the booking as CANCELLED.")
        .Produces<Booking>(StatusCodes.Status200OK)
        .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
        .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
        .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
        .WithRequestContextHeaders(includeIdempotencyHeaders: true);

        group.MapPost("/{bookingId}/change", (HttpRequest request, string bookingId, ChangeBookingRequest payload, BookingApplicationService service, IIdempotencyStore idempotencyStore, CancellationToken cancellationToken) =>
        {
            var userId = RequestContext.UserId(request);
            var actorType = RequestContext.ActorType(request);
            var payloadJson = JsonSerializer.Serialize(new { bookingId, payload }, JsonOptions);
            var requestHash = ComputeRequestHash("change", userId, actorType, payloadJson);
            return ExecuteAsyncWithIdempotency(
                request,
                idempotencyStore,
                "change",
                requestHash,
                () => service.ChangeAsync(
                    bookingId,
                    userId,
                    actorType,
                    payload,
                    RequestContext.CorrelationId(request),
                    cancellationToken));
        })
        .WithName("ChangeBooking")
        .WithSummary("Change an existing booking")
        .WithDescription("Releases the current hold, creates a replacement hold, and marks the booking as CHANGED.")
        .Accepts<ChangeBookingRequest>("application/json")
        .Produces<Booking>(StatusCodes.Status200OK)
        .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
        .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
        .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
        .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
        .WithRequestContextHeaders(includeIdempotencyHeaders: true);

        return endpoints;
    }

    private static IResult Execute(Func<object> action)
    {
        try
        {
            return Results.Ok(action());
        }
        catch (ArgumentException ex)
        {
            return Error(StatusCodes.Status400BadRequest, "BAD_REQUEST", ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return Error(StatusCodes.Status404NotFound, "NOT_FOUND", ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Error(StatusCodes.Status403Forbidden, "FORBIDDEN", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Error(StatusCodes.Status409Conflict, "CONFLICT", ex.Message);
        }
    }

    private static async Task<IResult> ExecuteAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return Results.Ok(await action());
        }
        catch (ArgumentException ex)
        {
            return Error(StatusCodes.Status400BadRequest, "BAD_REQUEST", ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return Error(StatusCodes.Status404NotFound, "NOT_FOUND", ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Error(StatusCodes.Status403Forbidden, "FORBIDDEN", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Error(StatusCodes.Status409Conflict, "CONFLICT", ex.Message);
        }
    }

    private static async Task<IResult> ExecuteAsyncWithIdempotency<T>(
        HttpRequest request,
        IIdempotencyStore idempotencyStore,
        string scope,
        string requestHash,
        Func<Task<T>> action)
    {
        try
        {
            var idempotencyKey = GetIdempotencyKey(request);
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                return Results.Ok(await action());
            }

            var existing = idempotencyStore.Get(idempotencyKey, scope);
            if (existing is not null)
            {
                if (!string.Equals(existing.RequestHash, requestHash, StringComparison.OrdinalIgnoreCase))
                {
                    return Error(StatusCodes.Status409Conflict, "CONFLICT", "idempotency key was already used with different request data");
                }

                return Results.Content(existing.ResponsePayload, "application/json");
            }

            var result = await action();
            var payload = JsonSerializer.Serialize(result, JsonOptions);
            var record = new IdempotencyRecord(
                Key: idempotencyKey,
                Scope: scope,
                RequestHash: requestHash,
                ResponsePayload: payload,
                CreatedAt: DateTimeOffset.UtcNow);

            if (!idempotencyStore.TrySave(record))
            {
                var stored = idempotencyStore.Get(idempotencyKey, scope);
                if (stored is not null)
                {
                    if (!string.Equals(stored.RequestHash, requestHash, StringComparison.OrdinalIgnoreCase))
                    {
                        return Error(StatusCodes.Status409Conflict, "CONFLICT", "idempotency key was already used with different request data");
                    }

                    return Results.Content(stored.ResponsePayload, "application/json");
                }
            }

            return Results.Ok(result);
        }
        catch (ArgumentException ex)
        {
            return Error(StatusCodes.Status400BadRequest, "BAD_REQUEST", ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return Error(StatusCodes.Status404NotFound, "NOT_FOUND", ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Error(StatusCodes.Status403Forbidden, "FORBIDDEN", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Error(StatusCodes.Status409Conflict, "CONFLICT", ex.Message);
        }
    }

    private static IResult Error(int status, string code, string message)
        => Results.Json(new ErrorResponse(code, message), statusCode: status);

    private static string? GetIdempotencyKey(HttpRequest request)
    {
        if (request.Headers.TryGetValue("Idempotency-Key", out var key) && !string.IsNullOrWhiteSpace(key))
        {
            return key.ToString();
        }

        if (request.Headers.TryGetValue("X-Idempotency-Key", out var legacyKey) && !string.IsNullOrWhiteSpace(legacyKey))
        {
            return legacyKey.ToString();
        }

        return null;
    }

    private static string ComputeRequestHash(string scope, string userId, ActorType actorType, string payload)
    {
        var raw = $"{scope}|{userId}|{actorType.HeaderValue()}|{payload}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }
}
