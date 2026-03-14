package com.cloudxplorer.flightservice.domain;

import java.time.Instant;

public record HoldRecord(
    String holdId,
    String bookingId,
    String flightId,
    int seatCount,
    String userId,
    ActorType actorType,
    Instant expiresAt,
    HoldStatus status) {}
