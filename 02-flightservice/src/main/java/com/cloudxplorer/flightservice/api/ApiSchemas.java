package com.cloudxplorer.flightservice.api;

import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

public final class ApiSchemas {

  private ApiSchemas() {}

  @Schema(name = "SearchFlightsResponse", description = "Flight search response with matching itinerary options.")
  public static record SearchFlightsResponse(
      @Schema(example = "customer") String actorType,
      SearchCriteria criteria,
      @Schema(example = "2") int count,
      PricingPolicies policies,
      List<FlightSummary> flights) {}

  @Schema(name = "SearchCriteria", description = "Normalized search criteria echoed back to the client.")
  public static record SearchCriteria(
      @Schema(example = "BLR") String from,
      @Schema(example = "DEL") String to,
      @Schema(example = "2026-04-10") String date) {}

  @Schema(name = "PricingPolicies", description = "Pricing and inventory rules applied by the service.")
  public static record PricingPolicies(
      @Schema(example = "bounded_by_flight_availability") String maxSeatCount,
      @Schema(example = "900") long holdTtlSeconds,
      @Schema(example = "0") int corpDiscountPercent) {}

  @Schema(name = "FlightSummary", description = "Flight inventory item returned by search and detail endpoints.")
  public static record FlightSummary(
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "VoyageVibes Air") String airline,
      @Schema(example = "BLR") String from,
      @Schema(example = "DEL") String to,
      @Schema(example = "2026-04-10T07:30:00Z") String departureAt,
      @Schema(example = "2026-04-10T10:15:00Z") String arrivalAt,
      @Schema(example = "6200") int baseFare,
      @Schema(example = "18") int availableSeats) {}

  @Schema(name = "AvailabilityResponse", description = "Current seat availability for a flight.")
  public static record AvailabilityResponse(
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "18") int availableSeats,
      @Schema(example = "AVAILABLE") String status,
      @Schema(example = "customer") String actorType) {}

  @Schema(name = "QuoteRequest", description = "Request used to calculate a fare quote for one flight.")
  public static record QuoteRequest(
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "2") Integer seatCount) {}

  @Schema(name = "QuoteResponse", description = "Calculated quote for the selected flight and passenger count.")
  public static record QuoteResponse(
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "INR") String currency,
      @Schema(example = "2") int seatCount,
      @Schema(example = "12400") int totalAmount,
      @Schema(example = "customer") String actorType) {}

  @Schema(name = "HoldRequest", description = "Request to reserve seats temporarily before booking is confirmed.")
  public static record HoldRequest(
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "2") Integer seatCount,
      @Schema(example = "BKG-1001") String bookingId) {}

  @Schema(name = "HoldActionRequest", description = "Request to release or commit an existing hold.")
  public static record HoldActionRequest(
      @Schema(example = "HOLD-AB12CD34EF56") String holdId,
      @Schema(example = "BKG-1001") String bookingId) {}

  @Schema(name = "HoldResponse", description = "Current state of a seat hold.")
  public static record HoldResponse(
      @Schema(example = "HOLD-AB12CD34EF56") String holdId,
      @Schema(example = "HELD") String status,
      @Schema(example = "FL-1001") String flightId,
      @Schema(example = "2") int seatCount,
      @Schema(example = "U-CUSTOMER-1") String userId,
      @Schema(example = "customer") String actorType,
      @Schema(example = "2026-04-06T10:15:30Z") String expiresAt,
      @Schema(example = "BKG-1001") String bookingId) {}

  @Schema(name = "HealthResponse", description = "Health probe response for the flight service.")
  public static record HealthResponse(
      @Schema(example = "UP") String status,
      HealthDetails details) {}

  @Schema(name = "HealthDetails", description = "Operational signals and dependency counters exposed by health endpoints.")
  public static record HealthDetails(
      @Schema(example = "health") String mode,
      @Schema(example = "flight-service") String service,
      @Schema(example = "configured") String db,
      @Schema(example = "3") long activeHolds,
      @Schema(example = "12") long publishedInventoryEvents,
      @Schema(example = "0") long failedInventoryPublishes,
      @Schema(example = "8") long consumedBookingEvents,
      @Schema(example = "0") long failedBookingEvents) {}

  @Schema(name = "ErrorResponse", description = "Standard API error payload.")
  public static record ErrorResponse(
      @Schema(example = "BAD_REQUEST") String code,
      @Schema(example = "flightId is required") String message) {}
}
