package com.cloudxplorer.flightservice.messaging;

public record BookingEvent(
    String eventId,
    String eventType,
    String occurredAt,
    String bookingId,
    String holdId,
    String flightId,
    Integer seatCount,
    String userId,
    String actorType) {}
