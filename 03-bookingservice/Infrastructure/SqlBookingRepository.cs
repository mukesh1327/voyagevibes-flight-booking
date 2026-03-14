using bookingservice.Domain;
using Microsoft.Data.SqlClient;

namespace bookingservice.Infrastructure;

public class SqlBookingRepository : IBookingRepository
{
    private readonly string _connectionString;

    public SqlBookingRepository(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("Booking DB connection string is required.", nameof(connectionString));
        }

        _connectionString = connectionString;
    }

    public string StorageName => "mssql";

    public Booking Save(Booking booking)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.bookings
            SET user_id = @user_id,
                flight_id = @flight_id,
                seat_count = @seat_count,
                status = @status,
                payment_status = @payment_status,
                hold_id = @hold_id,
                actor_type = @actor_type,
                updated_at = @updated_at
            WHERE booking_id = @booking_id;

            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO dbo.bookings (
                    booking_id,
                    user_id,
                    flight_id,
                    seat_count,
                    status,
                    payment_status,
                    hold_id,
                    actor_type,
                    updated_at
                )
                VALUES (
                    @booking_id,
                    @user_id,
                    @flight_id,
                    @seat_count,
                    @status,
                    @payment_status,
                    @hold_id,
                    @actor_type,
                    @updated_at
                );
            END;
            """;

        AddParameters(command, booking);
        command.ExecuteNonQuery();

        return booking;
    }

    public Booking SaveWithOutbox(Booking booking, OutboxEvent outboxEvent)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            using var bookingCommand = connection.CreateCommand();
            bookingCommand.Transaction = transaction;
            bookingCommand.CommandText = """
                UPDATE dbo.bookings
                SET user_id = @user_id,
                    flight_id = @flight_id,
                    seat_count = @seat_count,
                    status = @status,
                    payment_status = @payment_status,
                    hold_id = @hold_id,
                    actor_type = @actor_type,
                    updated_at = @updated_at
                WHERE booking_id = @booking_id;

                IF @@ROWCOUNT = 0
                BEGIN
                    INSERT INTO dbo.bookings (
                        booking_id,
                        user_id,
                        flight_id,
                        seat_count,
                        status,
                        payment_status,
                        hold_id,
                        actor_type,
                        updated_at
                    )
                    VALUES (
                        @booking_id,
                        @user_id,
                        @flight_id,
                        @seat_count,
                        @status,
                        @payment_status,
                        @hold_id,
                        @actor_type,
                        @updated_at
                    );
                END;
                """;
            AddParameters(bookingCommand, booking);
            bookingCommand.ExecuteNonQuery();

            using var outboxCommand = connection.CreateCommand();
            outboxCommand.Transaction = transaction;
            outboxCommand.CommandText = """
                INSERT INTO dbo.booking_outbox (
                    event_id,
                    event_type,
                    booking_id,
                    payload,
                    created_at,
                    publish_attempts
                )
                VALUES (
                    @event_id,
                    @event_type,
                    @booking_id,
                    @payload,
                    @created_at,
                    @publish_attempts
                );
                """;
            outboxCommand.Parameters.AddWithValue("@event_id", outboxEvent.EventId);
            outboxCommand.Parameters.AddWithValue("@event_type", outboxEvent.EventType);
            outboxCommand.Parameters.AddWithValue("@booking_id", outboxEvent.BookingId);
            outboxCommand.Parameters.AddWithValue("@payload", outboxEvent.Payload);
            outboxCommand.Parameters.AddWithValue("@created_at", outboxEvent.CreatedAt);
            outboxCommand.Parameters.AddWithValue("@publish_attempts", outboxEvent.PublishAttempts);
            outboxCommand.ExecuteNonQuery();

            transaction.Commit();
            return booking;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public Booking? FindById(string bookingId)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT booking_id,
                   user_id,
                   flight_id,
                   seat_count,
                   status,
                   payment_status,
                   hold_id,
                   actor_type,
                   updated_at
            FROM dbo.bookings
            WHERE booking_id = @booking_id;
            """;
        command.Parameters.AddWithValue("@booking_id", bookingId);

        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        return MapBooking(reader);
    }

    public IReadOnlyCollection<Booking> FindAll()
    {
        var results = new List<Booking>();

        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT booking_id,
                   user_id,
                   flight_id,
                   seat_count,
                   status,
                   payment_status,
                   hold_id,
                   actor_type,
                   updated_at
            FROM dbo.bookings;
            """;

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            results.Add(MapBooking(reader));
        }

        return results;
    }

    public IReadOnlyCollection<OutboxEvent> GetPendingOutbox(int maxCount)
    {
        var results = new List<OutboxEvent>();

        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            WITH next_batch AS (
                SELECT TOP (@batch_size) event_id
                FROM dbo.booking_outbox WITH (UPDLOCK, READPAST, ROWLOCK)
                WHERE published_at IS NULL
                  AND poisoned_at IS NULL
                ORDER BY created_at
            )
            UPDATE dbo.booking_outbox
            SET publish_attempts = publish_attempts + 1,
                last_attempt_at = SYSUTCDATETIME()
            OUTPUT inserted.event_id,
                   inserted.event_type,
                   inserted.booking_id,
                   inserted.payload,
                   inserted.created_at,
                   inserted.publish_attempts
            FROM dbo.booking_outbox
            INNER JOIN next_batch
                ON dbo.booking_outbox.event_id = next_batch.event_id;
            """;
        command.Parameters.AddWithValue("@batch_size", Math.Max(1, maxCount));

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            results.Add(new OutboxEvent(
                EventId: reader.GetString(0),
                EventType: reader.GetString(1),
                BookingId: reader.GetString(2),
                Payload: reader.GetString(3),
                CreatedAt: reader.GetDateTimeOffset(4),
                PublishAttempts: reader.GetInt32(5)));
        }

        return results;
    }

    public void MarkOutboxPublished(string eventId, DateTimeOffset publishedAt)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.booking_outbox
            SET published_at = @published_at,
                last_error = NULL
            WHERE event_id = @event_id;
            """;
        command.Parameters.AddWithValue("@event_id", eventId);
        command.Parameters.AddWithValue("@published_at", publishedAt);
        command.ExecuteNonQuery();
    }

    public void MarkOutboxFailed(string eventId, string error, DateTimeOffset failedAt)
    {
        var trimmedError = string.IsNullOrWhiteSpace(error)
            ? null
            : error.Length > 4000 ? error[..4000] : error;

        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.booking_outbox
            SET last_error = @last_error,
                last_attempt_at = @failed_at
            WHERE event_id = @event_id;
            """;
        command.Parameters.AddWithValue("@event_id", eventId);
        command.Parameters.AddWithValue("@last_error", (object?)trimmedError ?? DBNull.Value);
        command.Parameters.AddWithValue("@failed_at", failedAt);
        command.ExecuteNonQuery();
    }

    public void MarkOutboxPoisoned(string eventId, string error, DateTimeOffset poisonedAt)
    {
        var trimmedError = string.IsNullOrWhiteSpace(error)
            ? null
            : error.Length > 4000 ? error[..4000] : error;

        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.booking_outbox
            SET poisoned_at = @poisoned_at,
                last_error = @last_error
            WHERE event_id = @event_id;
            """;
        command.Parameters.AddWithValue("@event_id", eventId);
        command.Parameters.AddWithValue("@poisoned_at", poisonedAt);
        command.Parameters.AddWithValue("@last_error", (object?)trimmedError ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    private static void AddParameters(SqlCommand command, Booking booking)
    {
        command.Parameters.AddWithValue("@booking_id", booking.BookingId);
        command.Parameters.AddWithValue("@user_id", booking.UserId);
        command.Parameters.AddWithValue("@flight_id", booking.FlightId);
        command.Parameters.AddWithValue("@seat_count", booking.SeatCount);
        command.Parameters.AddWithValue("@status", booking.Status);
        command.Parameters.AddWithValue("@payment_status", booking.PaymentStatus);
        command.Parameters.AddWithValue("@hold_id", string.IsNullOrWhiteSpace(booking.HoldId) ? DBNull.Value : booking.HoldId);
        command.Parameters.AddWithValue("@actor_type", booking.ActorType);
        command.Parameters.AddWithValue("@updated_at", booking.UpdatedAt);
    }

    private static Booking MapBooking(SqlDataReader reader)
    {
        var holdId = reader.IsDBNull(6) ? string.Empty : reader.GetString(6);
        return new Booking(
            BookingId: reader.GetString(0),
            UserId: reader.GetString(1),
            FlightId: reader.GetString(2),
            SeatCount: reader.GetInt32(3),
            Status: reader.GetString(4),
            PaymentStatus: reader.GetString(5),
            HoldId: holdId,
            ActorType: reader.GetString(7),
            UpdatedAt: reader.GetDateTimeOffset(8));
    }
}
