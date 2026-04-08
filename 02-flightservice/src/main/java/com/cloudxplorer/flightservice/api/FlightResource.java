package com.cloudxplorer.flightservice.api;

import com.cloudxplorer.flightservice.application.FlightApplicationService;
import com.cloudxplorer.flightservice.domain.ActorType;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.NoSuchElementException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1")
@Produces(MediaType.APPLICATION_JSON)
public class FlightResource {

  private final FlightApplicationService service;

  public FlightResource(FlightApplicationService service) {
    this.service = service;
  }

  @GET
  @Path("/flights/search")
  @Tag(name = "Flights")
  @Operation(
      summary = "Search flights",
      description = "Returns available flights for a route and date using the current actor context.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Matching flights returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.SearchFlightsResponse.class))),
    @APIResponse(
        responseCode = "400",
        description = "Invalid request parameters.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response searchFlights(
      @Parameter(description = "Origin airport or city code.", example = "BLR")
      @QueryParam("from") String from,
      @Parameter(description = "Destination airport or city code.", example = "DEL")
      @QueryParam("to") String to,
      @Parameter(description = "Travel date in ISO format.", example = "2026-04-10")
      @QueryParam("date") String date,
      @Parameter(
              description = "Actor type used for policy evaluation. Defaults to customer when omitted.",
              example = "customer")
          @HeaderParam("X-Actor-Type")
          String actorType,
      @Parameter(
              description = "Fallback realm header when actor type is not sent.",
              example = "PUBLIC")
          @HeaderParam("X-Realm")
          String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return Response.ok(service.searchFlights(from, to, date, resolvedActorType)).build();
  }

  @GET
  @Path("/flights/{flightId}")
  @Tag(name = "Flights")
  @Operation(
      summary = "Get flight details",
      description = "Returns one flight with current fare and seat inventory.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Flight returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.FlightSummary.class))),
    @APIResponse(
        responseCode = "404",
        description = "Flight not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response getFlight(
      @Parameter(description = "Unique flight identifier.", required = true, example = "FL-1001")
      @PathParam("flightId") String flightId,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.getFlight(flightId, resolvedActorType));
  }

  @GET
  @Path("/flights/{flightId}/availability")
  @Tag(name = "Flights")
  @Operation(
      summary = "Check flight availability",
      description = "Returns available seats and overall inventory status for one flight.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Availability returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.AvailabilityResponse.class))),
    @APIResponse(
        responseCode = "404",
        description = "Flight not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response availability(
      @Parameter(description = "Unique flight identifier.", required = true, example = "FL-1001")
      @PathParam("flightId") String flightId,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.availability(flightId, resolvedActorType));
  }

  @POST
  @Path("/pricing/quote")
  @Consumes(MediaType.APPLICATION_JSON)
  @Tag(name = "Pricing")
  @Operation(
      summary = "Quote a flight",
      description = "Calculates the total fare for a flight and requested seat count.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Quote returned.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.QuoteResponse.class))),
    @APIResponse(
        responseCode = "400",
        description = "Invalid quote request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "404",
        description = "Flight not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "409",
        description = "Insufficient seats for the request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response quote(
      @RequestBody(
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = ApiSchemas.QuoteRequest.class)))
          Map<String, Object> request,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.quote(request, resolvedActorType));
  }

  @POST
  @Path("/inventory/hold")
  @Consumes(MediaType.APPLICATION_JSON)
  @Tag(name = "Inventory")
  @Operation(
      summary = "Hold seats",
      description = "Temporarily reserves seats and emits an INVENTORY_HELD event.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Hold created.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HoldResponse.class))),
    @APIResponse(
        responseCode = "400",
        description = "Invalid hold request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "404",
        description = "Flight not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "409",
        description = "Insufficient seats for the hold request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response hold(
      @RequestBody(
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = ApiSchemas.HoldRequest.class)))
          Map<String, Object> request,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm,
      @Parameter(
              description = "User identifier used for customer hold ownership enforcement.",
              example = "U-CUSTOMER-1")
          @HeaderParam("X-User-Id")
          String userId) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.hold(request, resolvedActorType, userId));
  }

  @POST
  @Path("/inventory/release")
  @Consumes(MediaType.APPLICATION_JSON)
  @Tag(name = "Inventory")
  @Operation(
      summary = "Release held seats",
      description = "Releases a hold back to inventory and emits an INVENTORY_RELEASED event.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Hold released or already in final state.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HoldResponse.class))),
    @APIResponse(
        responseCode = "400",
        description = "Invalid release request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "403",
        description = "Customer attempted to access another user's hold.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "404",
        description = "Hold not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response release(
      @RequestBody(
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = ApiSchemas.HoldActionRequest.class)))
          Map<String, Object> request,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm,
      @Parameter(
              description = "User identifier used for customer hold ownership enforcement.",
              example = "U-CUSTOMER-1")
          @HeaderParam("X-User-Id")
          String userId) {
    ActorType resolvedActorType = ActorType.fromContext(actorType, realm);
    return runHandled(() -> service.release(request, resolvedActorType, userId));
  }

  @POST
  @Path("/inventory/commit")
  @Consumes(MediaType.APPLICATION_JSON)
  @Tag(name = "Inventory")
  @Operation(
      summary = "Commit held seats",
      description = "Commits a hold to a booking and emits an INVENTORY_COMMITTED event.")
  @APIResponses({
    @APIResponse(
        responseCode = "200",
        description = "Hold committed.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.HoldResponse.class))),
    @APIResponse(
        responseCode = "400",
        description = "Invalid commit request.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "403",
        description = "Customer attempted to access another user's hold.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "404",
        description = "Hold not found.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class))),
    @APIResponse(
        responseCode = "409",
        description = "Hold already released or expired.",
        content =
            @Content(
                mediaType = MediaType.APPLICATION_JSON,
                schema = @Schema(implementation = ApiSchemas.ErrorResponse.class)))
  })
  public Response commit(
      @RequestBody(
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = ApiSchemas.HoldActionRequest.class)))
          Map<String, Object> request,
      @Parameter(description = "Actor type header.", example = "customer")
      @HeaderParam("X-Actor-Type") String actorType,
      @Parameter(description = "Realm header fallback.", example = "PUBLIC")
      @HeaderParam("X-Realm") String realm,
      @Parameter(
              description = "User identifier used for customer hold ownership enforcement.",
              example = "U-CUSTOMER-1")
          @HeaderParam("X-User-Id")
          String userId) {
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
