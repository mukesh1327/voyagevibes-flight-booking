\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE paymentservice LOGIN PASSWORD %L',
    'paymentservice'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'paymentservice'
)\gexec

SELECT format(
    'CREATE DATABASE paymentdb OWNER paymentservice'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'paymentdb'
)\gexec
