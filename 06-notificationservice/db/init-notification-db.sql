\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE notification_owner LOGIN PASSWORD %L',
    'Notification@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'notification_owner'
)\gexec

SELECT format(
    'CREATE ROLE notification_app_user LOGIN PASSWORD %L',
    'NotificationApp@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'notification_app_user'
)\gexec

SELECT format(
    'CREATE ROLE notification_read_user LOGIN PASSWORD %L',
    'NotificationRead@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'notification_read_user'
)\gexec

SELECT 'CREATE DATABASE notification_service_db OWNER notification_owner'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'notification_service_db'
)\gexec

\connect notification_service_db

ALTER DATABASE notification_service_db OWNER TO notification_owner;
CREATE SCHEMA IF NOT EXISTS notification AUTHORIZATION notification_owner;
ALTER DATABASE notification_service_db SET search_path TO notification, public;
ALTER ROLE notification_app_user IN DATABASE notification_service_db SET search_path TO notification, public;
ALTER ROLE notification_read_user IN DATABASE notification_service_db SET search_path TO notification, public;

CREATE TABLE IF NOT EXISTS notification.notification_audit (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    user_id TEXT,
    actor_type TEXT,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification.notification_audit OWNER TO notification_owner;

REVOKE ALL ON SCHEMA notification FROM PUBLIC;
GRANT USAGE ON SCHEMA notification TO notification_owner, notification_app_user, notification_read_user;
GRANT CONNECT, TEMP ON DATABASE notification_service_db TO notification_owner, notification_app_user, notification_read_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification.notification_audit TO notification_app_user;
GRANT SELECT ON notification.notification_audit TO notification_read_user;

ALTER DEFAULT PRIVILEGES FOR ROLE notification_owner IN SCHEMA notification
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO notification_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE notification_owner IN SCHEMA notification
GRANT SELECT ON TABLES TO notification_read_user;
