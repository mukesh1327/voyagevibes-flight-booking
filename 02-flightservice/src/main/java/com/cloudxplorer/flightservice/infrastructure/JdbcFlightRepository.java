package com.cloudxplorer.flightservice.infrastructure;

import com.cloudxplorer.flightservice.domain.Flight;
import com.cloudxplorer.flightservice.domain.FlightRepository;
import com.cloudxplorer.flightservice.domain.HoldRecord;
import com.cloudxplorer.flightservice.domain.HoldStatus;
import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
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
    String lockSql =
        """
        SELECT available_seats
        FROM flights
        WHERE flight_id = ?
        FOR UPDATE
        """;
    String updateSql =
        """
        UPDATE flights
        SET available_seats = available_seats - ?
        WHERE flight_id = ?
        """;
    try (var connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      try (PreparedStatement lockStatement = connection.prepareStatement(lockSql)) {
        lockStatement.setString(1, flightId);
        try (ResultSet rs = lockStatement.executeQuery()) {
          if (!rs.next()) {
            connection.rollback();
            return false;
          }
          int availableSeats = rs.getInt(1);
          if (availableSeats < seatCount) {
            connection.rollback();
            return false;
          }
        }
      }

      try (PreparedStatement updateStatement = connection.prepareStatement(updateSql)) {
        updateStatement.setInt(1, seatCount);
        updateStatement.setString(2, flightId);
        int updated = updateStatement.executeUpdate();
        if (updated != 1) {
          connection.rollback();
          return false;
        }
      }

      connection.commit();
      return true;
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

  @Override
  public Optional<HoldRecord> findHoldById(String holdId) {
    String sql =
        """
        SELECT hold_id,
               booking_id,
               flight_id,
               seat_count,
               user_id,
               actor_type,
               expires_at,
               status
        FROM flight_holds
        WHERE hold_id = ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setString(1, holdId);
      try (ResultSet rs = statement.executeQuery()) {
        if (!rs.next()) {
          return Optional.empty();
        }
        return Optional.of(toHold(rs));
      }
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to load hold: " + holdId, ex);
    }
  }

  @Override
  public HoldRecord createHold(HoldRecord hold) {
    String sql =
        """
        INSERT INTO flight_holds (
          hold_id,
          booking_id,
          flight_id,
          seat_count,
          user_id,
          actor_type,
          expires_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setString(1, hold.holdId());
      statement.setString(2, hold.bookingId());
      statement.setString(3, hold.flightId());
      statement.setInt(4, hold.seatCount());
      statement.setString(5, hold.userId());
      statement.setString(6, hold.actorType().headerValue());
      statement.setTimestamp(7, Timestamp.from(hold.expiresAt()));
      statement.setString(8, hold.status().name());
      statement.executeUpdate();
      return hold;
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to create hold: " + hold.holdId(), ex);
    }
  }

  @Override
  public boolean updateHoldStatus(String holdId, HoldStatus status) {
    String sql =
        """
        UPDATE flight_holds
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE hold_id = ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setString(1, status.name());
      statement.setString(2, holdId);
      return statement.executeUpdate() == 1;
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to update hold status: " + holdId, ex);
    }
  }

  @Override
  public List<HoldRecord> findExpiredHolds(int maxCount) {
    String sql =
        """
        SELECT hold_id,
               booking_id,
               flight_id,
               seat_count,
               user_id,
               actor_type,
               expires_at,
               status
        FROM flight_holds
        WHERE status = 'HELD'
          AND expires_at < ?
        ORDER BY expires_at
        LIMIT ?
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setTimestamp(1, Timestamp.from(Instant.now()));
      statement.setInt(2, Math.max(1, maxCount));
      try (ResultSet rs = statement.executeQuery()) {
        List<HoldRecord> holds = new ArrayList<>();
        while (rs.next()) {
          holds.add(toHold(rs));
        }
        return holds;
      }
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to load expired holds", ex);
    }
  }

  @Override
  public int countActiveHolds() {
    String sql =
        """
        SELECT COUNT(*) AS total
        FROM flight_holds
        WHERE status = 'HELD'
        """;
    try (var connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql);
        ResultSet rs = statement.executeQuery()) {
      if (!rs.next()) {
        return 0;
      }
      return rs.getInt("total");
    } catch (SQLException ex) {
      throw new IllegalStateException("failed to count active holds", ex);
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

  private HoldRecord toHold(ResultSet rs) throws SQLException {
    String actorType = rs.getString("actor_type");
    return new HoldRecord(
        rs.getString("hold_id"),
        rs.getString("booking_id"),
        rs.getString("flight_id"),
        rs.getInt("seat_count"),
        rs.getString("user_id"),
        "corp".equalsIgnoreCase(actorType) ? com.cloudxplorer.flightservice.domain.ActorType.CORP : com.cloudxplorer.flightservice.domain.ActorType.CUSTOMER,
        rs.getTimestamp("expires_at").toInstant(),
        HoldStatus.valueOf(rs.getString("status")));
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
