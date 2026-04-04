\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE authuser LOGIN PASSWORD %L',
    'Authservice@123$'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authuser'
)\gexec


SELECT 'CREATE DATABASE authdb OWNER authuser'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'authdb'
)\gexec


\connect authdb

ALTER DATABASE authdb OWNER TO authuser;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION authuser;
ALTER DATABASE authdb SET search_path TO auth, public;
ALTER ROLE authuser IN DATABASE authdb SET search_path TO auth, public;

CREATE TABLE IF NOT EXISTS auth.user_profile (
    user_id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    mobile VARCHAR(20),
    mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
    realm VARCHAR(32) NOT NULL,
    roles_csv TEXT NOT NULL DEFAULT '',
    profile_status VARCHAR(32) NOT NULL DEFAULT 'INCOMPLETE',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auth.user_profile OWNER TO authuser;
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS roles_csv TEXT NOT NULL DEFAULT '';
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS realm VARCHAR(32) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS profile_status VARCHAR(32) NOT NULL DEFAULT 'INCOMPLETE';
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE auth.user_profile
    ADD COLUMN IF NOT EXISTS manager_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS auth.user_session (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device VARCHAR(255),
    ip VARCHAR(64),
    risk_level VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_session_user
        FOREIGN KEY (user_id) REFERENCES auth.user_profile(user_id) ON DELETE CASCADE
);

ALTER TABLE auth.user_session OWNER TO authuser;
ALTER TABLE auth.user_session
    ADD COLUMN IF NOT EXISTS risk_level VARCHAR(32);
ALTER TABLE auth.user_session
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS auth.login_flow_state (
    state VARCHAR(128) PRIMARY KEY,
    code_verifier VARCHAR(256) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE auth.login_flow_state OWNER TO authuser;

CREATE TABLE IF NOT EXISTS auth.audit_event (
    event_id BIGSERIAL PRIMARY KEY,
    actor_user_id VARCHAR(64),
    event_type VARCHAR(100) NOT NULL,
    event_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auth.audit_event OWNER TO authuser;

CREATE INDEX IF NOT EXISTS idx_user_session_user_id
    ON auth.user_session(user_id);

CREATE INDEX IF NOT EXISTS idx_login_flow_state_expires_at
    ON auth.login_flow_state(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_event_type_created_at
    ON auth.audit_event(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_event_payload_gin
    ON auth.audit_event USING GIN(event_payload);

-- Seed corp users for local development (idempotent)
INSERT INTO auth.user_profile (
    user_id,
    email,
    first_name,
    last_name,
    mobile,
    mobile_verified,
    realm,
    roles_csv,
    profile_status,
    account_status,
    department,
    manager_id,
    updated_at
)
SELECT
    'corp_admin_001',
    'admin@airline.com',
    'Ava',
    'Admin',
    '9999999999',
    true,
    'CORP',
    'CORP_ADMIN',
    'COMPLETE',
    'ACTIVE',
    'Operations',
    NULL,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM auth.user_profile WHERE email = 'admin@airline.com'
);

INSERT INTO auth.user_profile (
    user_id,
    email,
    first_name,
    last_name,
    mobile,
    mobile_verified,
    realm,
    roles_csv,
    profile_status,
    account_status,
    department,
    manager_id,
    updated_at
)
SELECT
    'corp_finance_001',
    'finance@airline.com',
    'Noah',
    'Finance',
    '8888888888',
    true,
    'CORP',
    'FINANCE_AGENT',
    'COMPLETE',
    'ACTIVE',
    'Finance',
    'corp_admin_001',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM auth.user_profile WHERE email = 'finance@airline.com'
);

INSERT INTO auth.user_profile (
    user_id,
    email,
    first_name,
    last_name,
    mobile,
    mobile_verified,
    realm,
    roles_csv,
    profile_status,
    account_status,
    department,
    manager_id,
    updated_at
)
SELECT
    'corp_staff_001',
    'staff@airline.com',
    'Riya',
    'Staff',
    '7777777777',
    true,
    'CORP',
    'CORP_AGENT',
    'COMPLETE',
    'ACTIVE',
    'Customer Ops',
    'corp_admin_001',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM auth.user_profile WHERE email = 'staff@airline.com'
);
