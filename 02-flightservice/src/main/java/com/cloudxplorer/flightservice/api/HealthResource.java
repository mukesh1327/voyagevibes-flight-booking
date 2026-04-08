package com.cloudxplorer.flightservice.api;

import com.cloudxplorer.flightservice.application.FlightApplicationService;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource {

  private final FlightApplicationService service;

  public HealthResource(FlightApplicationService service) {
    this.service = service;
  }

  @GET
  @Tag(name = "Health")
  @Operation(
      summary = "Service health",
      description = "Returns the aggregated health status and operational counters for flight-service.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Health status returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HealthResponse.class)))
  })
  public Map<String, Object> health() {
    return service.health("health");
  }

  @GET
  @Path("/live")
  @Tag(name = "Health")
  @Operation(
      summary = "Liveness probe",
      description = "Returns liveness information for container and platform health checks.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Liveness status returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HealthResponse.class)))
  })
  public Map<String, Object> live() {
    return service.health("live");
  }

  @GET
  @Path("/ready")
  @Tag(name = "Health")
  @Operation(
      summary = "Readiness probe",
      description = "Returns readiness information including dependency counters and active holds.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Readiness status returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HealthResponse.class)))
  })
  public Map<String, Object> ready() {
    return service.health("ready");
  }
}
