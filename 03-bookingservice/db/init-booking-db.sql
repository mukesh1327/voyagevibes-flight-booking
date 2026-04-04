IF DB_ID(N'booking_service_db') IS NULL
BEGIN
    CREATE DATABASE booking_service_db;
END;
GO

USE booking_service_db;
GO

IF OBJECT_ID(N'dbo.bookings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bookings (
        booking_id NVARCHAR(64) NOT NULL PRIMARY KEY,
        user_id NVARCHAR(64) NOT NULL,
        flight_id NVARCHAR(32) NOT NULL,
        seat_count INT NOT NULL,
        status NVARCHAR(32) NOT NULL,
        payment_status NVARCHAR(32) NOT NULL,
        hold_id NVARCHAR(64) NULL,
        actor_type NVARCHAR(20) NOT NULL,
        updated_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_bookings_updated_at DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_bookings_user_id_status'
      AND object_id = OBJECT_ID(N'dbo.bookings')
)
BEGIN
    CREATE INDEX IX_bookings_user_id_status
        ON dbo.bookings(user_id, status);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_bookings_flight_id'
      AND object_id = OBJECT_ID(N'dbo.bookings')
)
BEGIN
    CREATE INDEX IX_bookings_flight_id
        ON dbo.bookings(flight_id);
END;
GO

IF OBJECT_ID(N'dbo.booking_outbox', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.booking_outbox (
        event_id NVARCHAR(64) NOT NULL PRIMARY KEY,
        event_type NVARCHAR(64) NOT NULL,
        booking_id NVARCHAR(64) NOT NULL,
        payload NVARCHAR(MAX) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_booking_outbox_created_at DEFAULT SYSUTCDATETIME(),
        published_at DATETIMEOFFSET NULL,
        publish_attempts INT NOT NULL CONSTRAINT DF_booking_outbox_publish_attempts DEFAULT 0,
        last_attempt_at DATETIMEOFFSET NULL,
        last_error NVARCHAR(4000) NULL,
        poisoned_at DATETIMEOFFSET NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_booking_outbox_published_at'
      AND object_id = OBJECT_ID(N'dbo.booking_outbox')
)
BEGIN
    CREATE INDEX IX_booking_outbox_published_at
        ON dbo.booking_outbox(published_at, created_at);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_booking_outbox_poisoned_at'
      AND object_id = OBJECT_ID(N'dbo.booking_outbox')
)
BEGIN
    CREATE INDEX IX_booking_outbox_poisoned_at
        ON dbo.booking_outbox(poisoned_at);
END;
GO

IF OBJECT_ID(N'dbo.booking_idempotency', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.booking_idempotency (
        idempotency_key NVARCHAR(128) NOT NULL,
        scope NVARCHAR(64) NOT NULL,
        request_hash NVARCHAR(64) NOT NULL,
        response_payload NVARCHAR(MAX) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_booking_idempotency_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_booking_idempotency PRIMARY KEY (idempotency_key, scope)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_booking_idempotency_created_at'
      AND object_id = OBJECT_ID(N'dbo.booking_idempotency')
)
BEGIN
    CREATE INDEX IX_booking_idempotency_created_at
        ON dbo.booking_idempotency(created_at);
END;
GO
