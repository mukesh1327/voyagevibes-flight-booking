package com.cloudxplorer.flightservice.api;

import com.cloudxplorer.flightservice.application.FlightApplicationService;
import com.cloudxplorer.flightservice.domain.ActorType;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.NoSuchElementException;
import java.util.Map;

@Path("/api/v1")
@Produces(MediaType.APPLICATION_JSON)
public class FlightResource {

  private final FlightApplicationService service;

  public FlightResource(FlightApplicationService service) {
    this.service = service;
  }

  @GET
  @Path("/flights/search")
  public Response searchFlights(
      @QueryParam("from") String from,
      @QueryParam("to") String to,
      @QueryParam("date") String date,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return Response.ok(service.searchFlights(from, to, date, resolvedActorType)).build();
  }

  @GET
  @Path("/flights/{flightId}")
  public Response getFlight(
      @PathParam("flightId") String flightId,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.getFlight(flightId, resolvedActorType));
  }

  @GET
  @Path("/flights/{flightId}/availability")
  public Response availability(
      @PathParam("flightId") String flightId,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.availability(flightId, resolvedActorType));
  }

  @POST
  @Path("/pricing/quote")
  public Response quote(
      Map<String, Object> request,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.quote(request, resolvedActorType));
  }

  @POST
  @Path("/inventory/hold")
  public Response hold(
      Map<String, Object> request,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm,
      @HeaderParam("X-User-Id") String userId) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.hold(request, resolvedActorType, userId));
  }

  @POST
  @Path("/inventory/release")
  public Response release(
      Map<String, Object> request,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm,
      @HeaderParam("X-User-Id") String userId) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.release(request, resolvedActorType, userId));
  }

  @POST
  @Path("/inventory/commit")
  public Response commit(
      Map<String, Object> request,
      @HeaderParam("X-Actor-Type") String actorType,
      @HeaderParam("X-Realm") String realm,
      @HeaderParam("X-User-Id") String userId) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.commit(request, resolvedActorType, userId));
  }

  private Response runHandled(ServiceCall action) {
    try {
      return Response.ok(action.run()).build();
    } catch (IllegalArgumentException ex) {
      return error(Response.Status.BAD_REQUEST, "BAD_REQUEST", ex.getMessage());
    } catch (NoSuchElementException ex) {
      return error(Response.Status.NOT_FOUND, "NOT_FOUND", ex.getMessage());
    } catch (SecurityException ex) {
      return error(Response.Status.FORBIDDEN, "FORBIDDEN", ex.getMessage());
    } catch (IllegalStateException ex) {
      return error(Response.Status.CONFLICT, "CONFLICT", ex.getMessage());
    }
  }

  private Response error(Response.Status status, String code, String message) {
    return Response.status(status).entity(Map.of("code", code, "message", message)).build();
  }

  @FunctionalInterface
  private interface ServiceCall {
    Object run();
  }
}
