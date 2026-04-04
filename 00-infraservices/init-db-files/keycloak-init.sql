\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE keycloak LOGIN PASSWORD %L',
    'Admin@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'keycloak'
)\gexec

SELECT format(
    'CREATE DATABASE keycloak OWNER keycloak'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'keycloak'
)\gexec
