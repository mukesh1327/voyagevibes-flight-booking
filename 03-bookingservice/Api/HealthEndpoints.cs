using bookingservice.Application;

namespace bookingservice.Api;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/health", (BookingApplicationService service) => Results.Ok(service.Health("health")));
        endpoints.MapGet("/api/v1/health/live", (BookingApplicationService service) => Results.Ok(service.Health("live")));
        endpoints.MapGet("/api/v1/health/ready", (BookingApplicationService service) => Results.Ok(service.Health("ready")));
        return endpoints;
    }
}
