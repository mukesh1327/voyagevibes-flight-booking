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
