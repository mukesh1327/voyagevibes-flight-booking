\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE payment_owner LOGIN PASSWORD %L',
    'Payment@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'payment_owner'
)\gexec

SELECT format(
    'CREATE ROLE payment_app_user LOGIN PASSWORD %L',
    'PaymentApp@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'payment_app_user'
)\gexec

SELECT format(
    'CREATE ROLE payment_read_user LOGIN PASSWORD %L',
    'PaymentRead@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'payment_read_user'
)\gexec

SELECT 'CREATE DATABASE payment_service_db OWNER payment_owner'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'payment_service_db'
)\gexec

\connect payment_service_db

ALTER DATABASE payment_service_db OWNER TO payment_owner;
CREATE SCHEMA IF NOT EXISTS payment AUTHORIZATION payment_owner;
ALTER DATABASE payment_service_db SET search_path TO payment, public;
ALTER ROLE payment_app_user IN DATABASE payment_service_db SET search_path TO payment, public;
ALTER ROLE payment_read_user IN DATABASE payment_service_db SET search_path TO payment, public;

CREATE TABLE IF NOT EXISTS payment.payments (
    payment_id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(32) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    user_id TEXT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_status VARCHAR(32) NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_refund_id TEXT,
    provider_payload JSONB,
    reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_payments_provider_payment_id_uq
    ON payment.payments(provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

ALTER TABLE payment.payments OWNER TO payment_owner;

REVOKE ALL ON SCHEMA payment FROM PUBLIC;
GRANT USAGE ON SCHEMA payment TO payment_owner, payment_app_user, payment_read_user;
GRANT CONNECT, TEMP ON DATABASE payment_service_db TO payment_owner, payment_app_user, payment_read_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment.payments TO payment_app_user;
GRANT SELECT ON payment.payments TO payment_read_user;

ALTER DEFAULT PRIVILEGES FOR ROLE payment_owner IN SCHEMA payment
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO payment_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE payment_owner IN SCHEMA payment
GRANT SELECT ON TABLES TO payment_read_user;
