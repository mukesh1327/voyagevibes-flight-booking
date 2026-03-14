using bookingservice.Application;
using bookingservice.Domain;
using Microsoft.Data.SqlClient;

namespace bookingservice.Infrastructure;

public class SqlIdempotencyStore : IIdempotencyStore
{
    private readonly string _connectionString;

    public SqlIdempotencyStore(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("Booking DB connection string is required.", nameof(connectionString));
        }

        _connectionString = connectionString;
    }

    public IdempotencyRecord? Get(string key, string scope)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT idempotency_key,
                   scope,
                   request_hash,
                   response_payload,
                   created_at
            FROM dbo.booking_idempotency
            WHERE idempotency_key = @key
              AND scope = @scope;
            """;
        command.Parameters.AddWithValue("@key", key);
        command.Parameters.AddWithValue("@scope", scope);

        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        return new IdempotencyRecord(
            Key: reader.GetString(0),
            Scope: reader.GetString(1),
            RequestHash: reader.GetString(2),
            ResponsePayload: reader.GetString(3),
            CreatedAt: reader.GetDateTimeOffset(4));
    }

    public bool TrySave(IdempotencyRecord record)
    {
        using var connection = new SqlConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.booking_idempotency (
                idempotency_key,
                scope,
                request_hash,
                response_payload,
                created_at
            )
            VALUES (
                @key,
                @scope,
                @request_hash,
                @response_payload,
                @created_at
            );
            """;
        command.Parameters.AddWithValue("@key", record.Key);
        command.Parameters.AddWithValue("@scope", record.Scope);
        command.Parameters.AddWithValue("@request_hash", record.RequestHash);
        command.Parameters.AddWithValue("@response_payload", record.ResponsePayload);
        command.Parameters.AddWithValue("@created_at", record.CreatedAt);

        try
        {
            command.ExecuteNonQuery();
            return true;
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            return false;
        }
    }
}
