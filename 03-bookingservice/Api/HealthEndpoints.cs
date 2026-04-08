using bookingservice.Application;

namespace bookingservice.Api;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/health", (BookingApplicationService service) => Results.Ok(service.Health("health")))
            .WithTags("Health")
            .WithName("GetHealth")
            .WithSummary("Get overall service health")
            .WithDescription("Returns service health details and Kafka processing counters.")
            .Produces<HealthResponse>(StatusCodes.Status200OK);

        endpoints.MapGet("/api/v1/health/live", (BookingApplicationService service) => Results.Ok(service.Health("live")))
            .WithTags("Health")
            .WithName("GetLiveness")
            .WithSummary("Get liveness health")
            .WithDescription("Returns a lightweight liveness response for runtime probes.")
            .Produces<HealthResponse>(StatusCodes.Status200OK);

        endpoints.MapGet("/api/v1/health/ready", (BookingApplicationService service) => Results.Ok(service.Health("ready")))
            .WithTags("Health")
            .WithName("GetReadiness")
            .WithSummary("Get readiness health")
            .WithDescription("Returns readiness details for dependency-aware health probes.")
            .Produces<HealthResponse>(StatusCodes.Status200OK);

        return endpoints;
    }
}
