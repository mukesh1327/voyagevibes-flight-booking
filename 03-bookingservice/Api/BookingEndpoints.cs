using bookingservice.Application;

namespace bookingservice.Api;

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/bookings");

        group.MapPost("/reserve", (HttpRequest request, ReserveBookingRequest payload, BookingApplicationService service, CancellationToken cancellationToken) =>
        {
            var userId = RequestContext.UserId(request);
            return ExecuteAsync(() => service.ReserveAsync(
                userId,
                RequestContext.ActorType(request),
                payload,
                RequestContext.CorrelationId(request),
                cancellationToken));
        });

        group.MapPost("/{bookingId}/confirm", (HttpRequest request, string bookingId, BookingApplicationService service, CancellationToken cancellationToken) =>
        {
            return ExecuteAsync(() => service.ConfirmAsync(
                bookingId,
                RequestContext.UserId(request),
                RequestContext.ActorType(request),
                RequestContext.CorrelationId(request),
                cancellationToken));
        });

        group.MapGet("/{bookingId}", (HttpRequest request, string bookingId, BookingApplicationService service) =>
        {
            return Execute(() => service.GetOne(bookingId, RequestContext.UserId(request), RequestContext.ActorType(request)));
        });

        group.MapGet("", (HttpRequest request, BookingApplicationService service) =>
        {
            return Results.Ok(service.GetMany(RequestContext.UserId(request), RequestContext.ActorType(request)));
        });

        group.MapPost("/{bookingId}/cancel", (HttpRequest request, string bookingId, BookingApplicationService service, CancellationToken cancellationToken) =>
        {
            return ExecuteAsync(() => service.CancelAsync(
                bookingId,
                RequestContext.UserId(request),
                RequestContext.ActorType(request),
                RequestContext.CorrelationId(request),
                cancellationToken));
        });

        group.MapPost("/{bookingId}/change", (HttpRequest request, string bookingId, ChangeBookingRequest payload, BookingApplicationService service, CancellationToken cancellationToken) =>
        {
            return ExecuteAsync(() => service.ChangeAsync(
                bookingId,
                RequestContext.UserId(request),
                RequestContext.ActorType(request),
                payload,
                RequestContext.CorrelationId(request),
                cancellationToken));
        });

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

    private static IResult Error(int status, string code, string message)
        => Results.Json(new { code, message }, statusCode: status);
}
