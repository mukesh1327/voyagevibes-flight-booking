package com.cloudxplorer.flightservice.infrastructure;

import com.cloudxplorer.flightservice.domain.Flight;
import com.cloudxplorer.flightservice.domain.FlightRepository;
import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@ApplicationScoped
public class JdbcFlightRepository implements FlightRepository {

  private final AgroalDataSource dataSource;

  public JdbcFlightRepository(AgroalDataSource dataSource) {
    this.dataSource = dataSource;
  }

  @Override
  public List<Flight> search(String from, String to, String date) {
    String normFrom = normalizeCode(from);
    String normTo = normalizeCode(to);
    LocalDate travelDate = normalizeDate(date);

    StringBuilder sql =
        new StringBuilder(
            """
            SELECT flight_id, airline, origin_code, destination_code, departure_at, arrival_at, base_fare, available_seats
            FROM flights
            WHERE 1=1
            """);
    List<Object> params = new ArrayList<>();

    if (normFrom != null) {
      sql.append(" AND origin_code = ?");
      params.add(normFrom);
    }
    if (normTo != null) {
      sql.append(" AND destination_code = ?");
      params.add(normTo);
    }
    if (travelDate != null) {
      sql.append(" AND DATE(departure_at) = ?");
      params.add(travelDate);
    }
    sql.append(" ORDER BY departure_at");

    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql.toString())) {
      for (int i = 0; i < params.size(); i++) {
        Object value = params.get(i);
        if (value instanceof LocalDate localDate) {
          statement.setDate(i + 1, java.sql.Date.valueOf(localDate));
        } else {
          statement.setString(i + 1, String.valueOf(value));
        }
      }
      try (ResultSet rs = statement.executeQuery()) {
        List<Flight> flights = new ArrayList<>();
        while (rs.next()) {
          flights.add(toFlight(rs));
        }
        return flights;
      }
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to search flights", ex);
    }
  }

  @Override
  public Optional<Flight> findById(String flightId) {
    String sql =
        """
        SELECT flight_id, airline, origin_code, destination_code, departure_at, arrival_at, base_fare, available_seats
        FROM flights
        WHERE flight_id = ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setString(1, flightId);
      try (ResultSet rs = statement.executeQuery()) {
        if (!rs.next()) {
          return Optional.empty();
        }
        return Optional.of(toFlight(rs));
      }
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to find flight by id: " + flightId, ex);
    }
  }

  @Override
  public boolean reserveSeats(String flightId, int seatCount) {
    String sql =
        """
        UPDATE flights
        SET available_seats = available_seats - ?
        WHERE flight_id = ?
          AND available_seats >= ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setInt(1, seatCount);
      statement.setString(2, flightId);
      statement.setInt(3, seatCount);
      return statement.executeUpdate() == 1;
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to reserve seats for flight: " + flightId, ex);
    }
  }

  @Override
  public void releaseSeats(String flightId, int seatCount) {
    String sql =
        """
        UPDATE flights
        SET available_seats = LEAST(total_seats, available_seats + ?)
        WHERE flight_id = ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setInt(1, seatCount);
      statement.setString(2, flightId);
      int updated = statement.executeUpdate();
      if (updated != 1) {
        throw new IllegalStateException("flight not found while releasing seats: " + flightId);
      }
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to release seats for flight: " + flightId, ex);
    }
  }

  private Flight toFlight(ResultSet rs) throws SQLException {
    return new Flight(
        rs.getString("flight_id"),
        rs.getString("airline"),
        rs.getString("origin_code"),
        rs.getString("destination_code"),
        toIsoUtc(rs.getTimestamp("departure_at")),
        toIsoUtc(rs.getTimestamp("arrival_at")),
        rs.getInt("base_fare"),
        rs.getInt("available_seats"));
  }

  private String toIsoUtc(Timestamp timestamp) {
    if (timestamp == null) {
      return "";
    }
    return timestamp.toInstant().toString();
  }

  private String normalizeCode(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim().toUpperCase(Locale.ROOT);
  }

  private LocalDate normalizeDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return LocalDate.parse(value.trim());
  }
}
