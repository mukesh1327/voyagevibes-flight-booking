package com.cloudxplorer.flightservice.messaging;

public record InventoryEvent(
    String eventId,
    String eventType,
    String occurredAt,
    String flightId,
    String holdId,
    String bookingId,
    int seatCount,
    String actorType,
    String userId,
    String status,
    String reason,
    String source) {}
