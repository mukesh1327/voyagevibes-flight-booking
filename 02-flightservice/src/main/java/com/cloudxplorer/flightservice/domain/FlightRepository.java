package com.cloudxplorer.flightservice.domain;

import java.util.List;
import java.util.Optional;

public interface FlightRepository {
  List<Flight> search(String from, String to, String date);

  Optional<Flight> findById(String flightId);

  boolean reserveSeats(String flightId, int seatCount);

  void releaseSeats(String flightId, int seatCount);
}
