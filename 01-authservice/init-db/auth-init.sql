\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE authservice LOGIN PASSWORD %L',
    'authservice'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authservice'
)\gexec

SELECT format(
    'CREATE DATABASE authdb OWNER authservice'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'authdb'
)\gexec
