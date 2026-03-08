package com.cloudxplorer.flightservice.domain;

public record Flight(
    String flightId,
    String airline,
    String from,
    String to,
    String departureAt,
    String arrivalAt,
    int baseFare,
    int availableSeats) {}
