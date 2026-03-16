\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE kong LOGIN PASSWORD %L',
    'kongpass123'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'kong'
)\gexec

SELECT format(
    'CREATE DATABASE kong OWNER kong'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'kong'
)\gexec
