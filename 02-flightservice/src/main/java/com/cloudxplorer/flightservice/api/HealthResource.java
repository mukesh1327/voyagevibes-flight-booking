package com.cloudxplorer.flightservice.api;

import com.cloudxplorer.flightservice.application.FlightApplicationService;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;

@Path("/api/v1/health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource {

  private final FlightApplicationService service;

  public HealthResource(FlightApplicationService service) {
    this.service = service;
  }

  @GET
  public Map<String, Object> health() {
    return service.health("health");
  }

  @GET
  @Path("/live")
  public Map<String, Object> live() {
    return service.health("live");
  }

  @GET
  @Path("/ready")
  public Map<String, Object> ready() {
    return service.health("ready");
  }
}
