package com.cloudxplorer.flightservice.application;

import com.cloudxplorer.flightservice.domain.ActorType;
import com.cloudxplorer.flightservice.domain.Flight;
import com.cloudxplorer.flightservice.domain.FlightRepository;
import com.cloudxplorer.flightservice.domain.HoldRecord;
import com.cloudxplorer.flightservice.domain.HoldStatus;
import com.cloudxplorer.flightservice.messaging.BookingEvent;
import com.cloudxplorer.flightservice.messaging.InventoryEvent;
import com.cloudxplorer.flightservice.messaging.InventoryEventPublisher;
import com.cloudxplorer.flightservice.messaging.KafkaFlowMetrics;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class FlightApplicationService {

  private static final Duration HOLD_TTL = Duration.ofMinutes(15);
  private static final Duration SEARCH_CACHE_TTL = Duration.ofSeconds(30);
  private static final String DEFAULT_USER_ID = "U-DEFAULT";

  private final FlightRepository repository;
  private final InventoryEventPublisher inventoryEventPublisher;
  private final KafkaFlowMetrics kafkaFlowMetrics;
  private final Map<String, SearchCacheEntry> searchCache = new ConcurrentHashMap<>();

  public FlightApplicationService(
      FlightRepository repository,
      InventoryEventPublisher inventoryEventPublisher,
      KafkaFlowMetrics kafkaFlowMetrics) {
    this.repository = repository;
    this.inventoryEventPublisher = inventoryEventPublisher;
    this.kafkaFlowMetrics = kafkaFlowMetrics;
  }

  public Map<String, Object> searchFlights(String from, String to, String date, ActorType actorType) {
    cleanupExpiredHolds();
    String cacheKey = buildSearchCacheKey(from, to, date);
    List<Flight> flights = getCachedSearch(cacheKey);
    if (flights == null) {
      flights = repository.search(from, to, date);
      searchCache.put(cacheKey, new SearchCacheEntry(flights, Instant.now().plus(SEARCH_CACHE_TTL)));
    }

    return Map.of(
        "actorType", actorType.headerValue(),
        "criteria", Map.of("from", safe(from), "to", safe(to), "date", safe(date)),
        "count", flights.size(),
        "policies", pricingAndInventoryPolicies(),
        "flights", flights);
  }

  public Flight getFlight(String flightId, ActorType actorType) {
    cleanupExpiredHolds();
    return requireFlight(flightId);
  }

  public Map<String, Object> availability(String flightId, ActorType actorType) {
    Flight flight = getFlight(flightId, actorType);
    return Map.of(
        "flightId", flight.flightId(),
        "availableSeats", flight.availableSeats(),
        "status", flight.availableSeats() > 0 ? "AVAILABLE" : "SOLD_OUT",
        "actorType", actorType.headerValue());
  }

  public Map<String, Object> quote(Map<String, Object> request, ActorType actorType) {
    cleanupExpiredHolds();
    request = ensureRequest(request);
    String flightId = requiredText(request, "flightId");
    int seatCount = resolveSeatCount(request);

    Flight flight = getFlight(flightId, actorType);
    assertSeatAvailability(flight, seatCount);

    int totalAmount = seatCount * flight.baseFare();

    return Map.of(
        "flightId", flight.flightId(),
        "currency", "INR",
        "seatCount", seatCount,
        "totalAmount", totalAmount,
        "actorType", actorType.headerValue());
  }

  public synchronized Map<String, Object> hold(Map<String, Object> request, ActorType actorType, String userId) {
    cleanupExpiredHolds();
    request = ensureRequest(request);
    String flightId = requiredText(request, "flightId");
    int seatCount = resolveSeatCount(request);

    Flight flight = getFlight(flightId, actorType);
    if (!repository.reserveSeats(flight.flightId(), seatCount)) {
      throw new IllegalStateException("insufficient seats for flight: " + flight.flightId());
    }

    String holdId = "HOLD-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    Instant expiresAt = Instant.now().plus(HOLD_TTL);
    String bookingId = safe(asString(request.get("bookingId")));
    HoldRecord hold = new HoldRecord(
        holdId,
        bookingId,
        flightId,
        seatCount,
        normalizeUserId(userId),
        actorType,
        expiresAt,
        HoldStatus.HELD);

    try {
      repository.createHold(hold);
    } catch (Exception ex) {
      releaseSeats(flightId, seatCount);
      throw ex;
    }

    emitInventoryEvent("INVENTORY_HELD", hold, bookingId, "API_HOLD");

    return holdResponse(hold, request);
  }

  public synchronized Map<String, Object> release(Map<String, Object> request, ActorType actorType, String userId) {
    cleanupExpiredHolds();
    request = ensureRequest(request);
    HoldRecord hold = resolveAuthorizedHold(requiredText(request, "holdId"), actorType, userId);
    HoldRecord current = hold;

    if (hold.status() == HoldStatus.HELD) {
      releaseSeats(hold.flightId(), hold.seatCount());
      repository.updateHoldStatus(hold.holdId(), HoldStatus.RELEASED);
      current = withStatus(hold, HoldStatus.RELEASED);
      emitInventoryEvent("INVENTORY_RELEASED", current, resolveBookingId(request, current), "API_RELEASE");
    }

    return holdResponse(current, request);
  }

  public synchronized Map<String, Object> commit(Map<String, Object> request, ActorType actorType, String userId) {
    cleanupExpiredHolds();
    request = ensureRequest(request);
    HoldRecord hold = resolveAuthorizedHold(requiredText(request, "holdId"), actorType, userId);

    if (hold.status() == HoldStatus.RELEASED) {
      throw new IllegalStateException("hold already released: " + hold.holdId());
    }
    if (hold.status() == HoldStatus.EXPIRED) {
      throw new IllegalStateException("hold already expired: " + hold.holdId());
    }
    repository.updateHoldStatus(hold.holdId(), HoldStatus.COMMITTED);
    HoldRecord committed = withStatus(hold, HoldStatus.COMMITTED);

    Map<String, Object> result = new LinkedHashMap<>(holdResponse(committed, request));
    String bookingId = resolveBookingId(request, committed);
    result.put("bookingId", bookingId);
    emitInventoryEvent("INVENTORY_COMMITTED", committed, bookingId, "API_COMMIT");
    return result;
  }

  public void releaseFromBookingEvent(BookingEvent event) {
    if (event.holdId() != null && !event.holdId().isBlank()) {
      Map<String, Object> request = new LinkedHashMap<>();
      request.put("holdId", event.holdId().trim());
      if (event.bookingId() != null && !event.bookingId().isBlank()) {
        request.put("bookingId", event.bookingId().trim());
      }
      release(request, ActorType.CORP, event.userId());
      return;
    }

    int seatCount = event.seatCount() == null ? 0 : event.seatCount();
    if (event.flightId() == null || event.flightId().isBlank() || seatCount <= 0) {
      throw new IllegalArgumentException("booking cancel event must carry holdId or (flightId and seatCount)");
    }

    repository.releaseSeats(event.flightId().trim(), seatCount);
    emitInventoryEvent(
        "INVENTORY_RELEASED",
        event.flightId().trim(),
        "",
        safe(event.bookingId()),
        seatCount,
        ActorType.CORP,
        normalizeUserId(event.userId()),
        HoldStatus.RELEASED.name(),
        "BOOKING_CANCEL_EVENT");
  }

  public void commitFromBookingEvent(BookingEvent event) {
    if (event.holdId() == null || event.holdId().isBlank()) {
      throw new IllegalArgumentException("booking confirm event must carry holdId");
    }

    Map<String, Object> request = new LinkedHashMap<>();
    request.put("holdId", event.holdId().trim());
    if (event.bookingId() != null && !event.bookingId().isBlank()) {
      request.put("bookingId", event.bookingId().trim());
    }
    commit(request, ActorType.CORP, event.userId());
  }

  public Map<String, Object> health(String mode) {
    cleanupExpiredHolds();
    long activeHolds = repository.countActiveHolds();
    Map<String, Object> details = new LinkedHashMap<>();
    details.put("mode", mode);
    details.put("service", "flight-service");
    details.put("db", "configured");
    details.put("activeHolds", activeHolds);
    details.put("publishedInventoryEvents", kafkaFlowMetrics.publishedInventoryEvents());
    details.put("failedInventoryPublishes", kafkaFlowMetrics.failedInventoryPublishes());
    details.put("consumedBookingEvents", kafkaFlowMetrics.consumedBookingEvents());
    details.put("failedBookingEvents", kafkaFlowMetrics.failedBookingEvents());
    return Map.of("status", "UP", "details", details);
  }

  private String safe(String value) {
    return value == null ? "" : value;
  }

  private Flight requireFlight(String flightId) {
    return repository.findById(flightId).orElseThrow(() -> new NoSuchElementException("flight not found: " + flightId));
  }

  private int resolveSeatCount(Map<String, Object> request) {
    Object raw = request.getOrDefault("seatCount", 1);
    int seatCount;
    try {
      seatCount = Integer.parseInt(String.valueOf(raw));
    } catch (NumberFormatException ex) {
      throw new IllegalArgumentException("seatCount must be a valid integer");
    }
    if (seatCount <= 0) {
      throw new IllegalArgumentException("seatCount must be greater than zero");
    }
    return seatCount;
  }

  private String requiredText(Map<String, Object> request, String key) {
    Object value = request.get(key);
    if (value == null || String.valueOf(value).isBlank()) {
      throw new IllegalArgumentException(key + " is required");
    }
    return String.valueOf(value).trim();
  }

  private void assertSeatAvailability(Flight flight, int seatCount) {
    if (seatCount > flight.availableSeats()) {
      throw new IllegalStateException("insufficient seats for flight: " + flight.flightId());
    }
  }

  private Map<String, Object> ensureRequest(Map<String, Object> request) {
    if (request == null) {
      throw new IllegalArgumentException("request body is required");
    }
    return request;
  }

  private String normalizeUserId(String userId) {
    return userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
  }

  private synchronized void cleanupExpiredHolds() {
    for (HoldRecord hold : repository.findExpiredHolds(50)) {
      releaseSeats(hold.flightId(), hold.seatCount());
      repository.updateHoldStatus(hold.holdId(), HoldStatus.EXPIRED);
      HoldRecord expired = withStatus(hold, HoldStatus.EXPIRED);
      emitInventoryEvent("INVENTORY_EXPIRED", expired, safe(hold.bookingId()), "HOLD_EXPIRED");
    }
  }

  private HoldRecord resolveAuthorizedHold(String holdId, ActorType actorType, String userId) {
    HoldRecord hold = repository.findHoldById(holdId).orElse(null);
    if (hold == null) {
      throw new NoSuchElementException("hold not found: " + holdId);
    }
    if (actorType == ActorType.CUSTOMER
        && !hold.userId().equalsIgnoreCase(normalizeUserId(userId))) {
      throw new SecurityException("customer cannot access another user's hold");
    }
    return hold;
  }

  private void releaseSeats(String flightId, int seatCount) {
    repository.releaseSeats(flightId, seatCount);
  }

  private void emitInventoryEvent(String eventType, HoldRecord hold, String bookingId, String reason) {
    emitInventoryEvent(
        eventType,
        hold.flightId(),
        hold.holdId(),
        bookingId,
        hold.seatCount(),
        hold.actorType(),
        hold.userId(),
        hold.status().name(),
        reason);
  }

  private void emitInventoryEvent(
      String eventType,
      String flightId,
      String holdId,
      String bookingId,
      int seatCount,
      ActorType actorType,
      String userId,
      String status,
      String reason) {
    inventoryEventPublisher.publish(
        new InventoryEvent(
            UUID.randomUUID().toString(),
            eventType,
            Instant.now().toString(),
            safe(flightId),
            safe(holdId),
            safe(bookingId),
            seatCount,
            actorType.headerValue(),
            normalizeUserId(userId),
            status,
            reason,
            "flight-service"));
  }

  private String asString(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private Map<String, Object> holdResponse(HoldRecord hold, Map<String, Object> request) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("holdId", hold.holdId());
    response.put("status", hold.status().name());
    response.put("flightId", hold.flightId());
    response.put("seatCount", hold.seatCount());
    response.put("userId", hold.userId());
    response.put("actorType", hold.actorType().headerValue());
    response.put("expiresAt", hold.expiresAt().toString());
    String bookingId = resolveBookingId(request, hold);
    if (!bookingId.isBlank()) {
      response.put("bookingId", bookingId);
    }
    return response;
  }

  private String resolveBookingId(Map<String, Object> request, HoldRecord hold) {
    if (request != null && request.containsKey("bookingId")) {
      return String.valueOf(request.get("bookingId"));
    }
    return safe(hold.bookingId());
  }

  private HoldRecord withStatus(HoldRecord hold, HoldStatus status) {
    return new HoldRecord(
        hold.holdId(),
        hold.bookingId(),
        hold.flightId(),
        hold.seatCount(),
        hold.userId(),
        hold.actorType(),
        hold.expiresAt(),
        status);
  }

  private Map<String, Object> pricingAndInventoryPolicies() {
    return Map.of(
        "maxSeatCount", "bounded_by_flight_availability",
        "holdTtlSeconds", HOLD_TTL.toSeconds(),
        "corpDiscountPercent", 0);
  }

  private List<Flight> getCachedSearch(String cacheKey) {
    SearchCacheEntry entry = searchCache.get(cacheKey);
    if (entry == null) {
      return null;
    }
    if (entry.expiresAt().isBefore(Instant.now())) {
      searchCache.remove(cacheKey);
      return null;
    }
    return entry.flights();
  }

  private String buildSearchCacheKey(String from, String to, String date) {
    return normalizeKey(from) + "|" + normalizeKey(to) + "|" + normalizeKey(date);
  }

  private String normalizeKey(String value) {
    if (value == null || value.isBlank()) {
      return "-";
    }
    return value.trim().toUpperCase(Locale.ROOT);
  }

  private record SearchCacheEntry(List<Flight> flights, Instant expiresAt) {}
}
