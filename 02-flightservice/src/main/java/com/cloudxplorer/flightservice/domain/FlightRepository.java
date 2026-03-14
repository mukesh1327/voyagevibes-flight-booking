package com.cloudxplorer.flightservice.domain;

import java.util.List;
import java.util.Optional;

public interface FlightRepository {
  List<Flight> search(String from, String to, String date);

  Optional<Flight> findById(String flightId);

  boolean reserveSeats(String flightId, int seatCount);

  void releaseSeats(String flightId, int seatCount);

  Optional<HoldRecord> findHoldById(String holdId);

  HoldRecord createHold(HoldRecord hold);

  boolean updateHoldStatus(String holdId, HoldStatus status);

  List<HoldRecord> findExpiredHolds(int maxCount);

  int countActiveHolds();
}
