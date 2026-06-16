# Flight Booking Authentication Service

## Overview

This service is the authentication boundary for the Flight Booking platform. It sits behind Kong Gateway, delegates identity management to Keycloak, validates Keycloak-issued JWTs, and exposes clean REST APIs for customer and corporate sign-in flows.

The service is designed for containerized deployment with Podman and follows microservice-friendly defaults:

- Port `8081`
- Stateless JWT authentication
- Health probes through `/health`, `/actuator/health/liveness`, and `/actuator/health/readiness`
- Simple correlated console logs plus per-request API access logs
- Environment-driven configuration
- Structured logs to stdout and `logs/authservice.log` by default
- OpenAPI 3 + grouped Swagger UI at `/swagger-ui`, `/docs/customer`, `/docs/corporate`, and `/docs/operations`

## Purpose

This auth service handles application-facing authentication concerns while leaving credential ownership to Keycloak.

- Customer users authenticate with Google through Keycloak identity brokering.
- Corporate users authenticate through Keycloak federation such as LDAP, SSO, or an external IdP.
- The service validates JWTs, maps roles, exposes user metadata, and optionally stores minimal customer profile data locally.

## Role In The Flight Booking System

```text
Client App -> Kong Gateway -> Auth Service -> Keycloak
                                      \
                                       -> Customer metadata store
```

- Kong fronts the service and can enforce upstream policies, rate limits, and routing.
- Keycloak remains the single Identity Provider and token issuer.
- This service becomes the application-specific adapter for auth APIs, token validation, role mapping, and delete/logout flows.

## Architecture

### Runtime

- Java 17
- Spring Boot 3
- Spring Security OAuth2 Resource Server
- Spring Data JPA + Flyway
- H2 by default, PostgreSQL for containerized environments
- pgJDBC `42.7.11` for secure PostgreSQL connectivity
- OpenTelemetry-ready logs, traces, and metrics export via OTLP
- Podman-compatible `src/docker/Dockerfile`

### Auth Design

- Customer register/login:
  browser authenticates with Google through Keycloak, receives a Keycloak authorization code, then exchanges that code with this service.
- Corporate login:
  browser authenticates through a federated Keycloak flow, receives a Keycloak authorization code, then exchanges that code with this service.
- Authenticated API access:
  clients send `Authorization: Bearer <access_token>` and the service validates the JWT signature and issuer using Keycloak JWKs.

### Role Mapping

- Keycloak `customer` role -> application customer access
- Keycloak `corporate` role -> application corporate access
- Keycloak `admin` role -> privileged delete operations

The service reads roles from both:

- `realm_access.roles`
- `resource_access.{clientId}.roles`

## Setup Instructions

### 1. Run Keycloak In Podman

Create a network:

```bash
podman network create flight-net
```

Run Keycloak:

```bash
podman run -d \
  --name keycloak \
  --network flight-net \
  -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:25.0 \
  start-dev
```

Open the admin console at `http://localhost:8080`.

### 2. Configure Keycloak

Import the bundled realm file:

```bash
podman cp docs/keycloak/flight-booking-realm.json keycloak:/tmp/flight-booking-realm.json
podman exec keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password '<admin-password>'
podman exec keycloak /opt/keycloak/bin/kcadm.sh create realms -f /tmp/flight-booking-realm.json
```

The import provisions the single realm shape expected by this service:

- Realm: `flight-booking`
- Customer base role: `customer`
- Corporate base role: `corporate`
- Admin role: `admin`
- Corporate sub-roles: `support-desk`, `booking-ops`, `finance-ops`, `flight-admin`, `pricing-analyst`, `corporate-travel-manager`, `reporting-analyst`, `super-admin`
- Login client: `flight-auth-service`
- Admin client: `flight-auth-admin`
- Google identity-provider alias: `google`

After import:

- rotate the imported placeholder client secrets for `flight-auth-service` and `flight-auth-admin`
- copy the generated secrets into `KEYCLOAK_CLIENT_SECRET` and `KEYCLOAK_ADMIN_CLIENT_SECRET`
- keep `KEYCLOAK_ADMIN_CLIENT_ID=flight-auth-admin` if you want token introspection and delete-user support

The bundled `flight-auth-admin` client is configured for client-credentials access and includes the realm-management roles required by this service for user deletion.

### 3. Configure Google Login In Keycloak

In Google Cloud Console:

1. Create OAuth credentials.
2. Add the redirect URI:
   `http://localhost:8080/realms/flight-booking/broker/google/endpoint`

In Keycloak:

1. Open the imported `flight-booking` realm.
2. Go to `Identity Providers` and open the existing `google` provider.
3. Paste the real Google client ID and secret.
4. Keep alias `google` so `/auth/customer/login` continues validating the expected broker.
5. Keep the included mapper that assigns Google-brokered users to the `/customers` group.

The imported `/customers` group already grants the `customer` realm role, so Google-brokered users inherit the base customer access expected by the auth-service.

### 4. Configure Corporate Federation

Corporate users do not register locally through this service.

Configure one of the following in Keycloak:

- LDAP federation
- SAML external IdP
- OIDC external IdP

Ensure corporate identities land in one of the imported `/corporate-users/*` groups or otherwise receive the `corporate` role plus any needed workforce sub-role.

Recommended workforce roles:

- `support-desk` for customer payment, refund, and booking support
- `booking-ops` for itinerary and operational booking changes
- `finance-ops` for reconciliation, refunds, and chargeback reviews
- `flight-admin` for flight schedule and inventory changes
- `pricing-analyst` for pricing and commercial analysis
- `corporate-travel-manager` for enterprise account support
- `reporting-analyst` for read-only analytics and audit views
- `super-admin` for privileged platform administration with MFA

### 5. Run This Service Locally

Copy the sample env file values into your shell or container runtime.

Build the jar:

```bash
./mvnw clean package
```

Run locally:

```bash
./mvnw spring-boot:run
```

The service starts on `http://localhost:8081`.

### 6. Run This Service In Podman

Build the image:

```bash
podman build -f src/docker/Dockerfile -t flight-authservice:latest .
```

Run it:

```bash
podman run -d \
  --name flight-authservice \
  --network flight-net \
  -p 8081:8081 \
  --env-file .env.example \
  flight-authservice:latest
```

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SERVER_PORT` | No | `8081` | HTTP port exposed by the service |
| `KEYCLOAK_URL` | Yes | `http://localhost:8090` | Base URL of Keycloak for local development; use `http://keycloak:8080` inside the Podman network |
| `KEYCLOAK_REALM` | Yes | `flight-booking` | Keycloak realm |
| `KEYCLOAK_CLIENT_ID` | Yes | `flight-auth-service` | OIDC client used for auth code exchange |
| `KEYCLOAK_CLIENT_SECRET` | Recommended | empty | Secret for the imported `flight-auth-service` confidential client |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Recommended | client ID value | Admin client used for introspection and delete-user operations; set `flight-auth-admin` when using the bundled realm import |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Recommended | client secret value | Secret for the imported `flight-auth-admin` admin client |
| `KEYCLOAK_DEFAULT_REDIRECT_URI` | No | `http://localhost:8081/swagger-ui/oauth2-redirect.html` | Default redirect URI for docs/testing |
| `KEYCLOAK_GOOGLE_PROVIDER_ALIAS` | No | `google` | Broker alias used for customer login validation |
| `KEYCLOAK_CONNECT_TIMEOUT` | No | `5s` | Connect timeout for outbound Keycloak calls |
| `KEYCLOAK_READ_TIMEOUT` | No | `5s` | Read timeout for outbound Keycloak calls |
| `KEYCLOAK_TRUST_STORE_PATH` | No | empty | Optional Java truststore path for HTTPS Keycloak certificates not already trusted by the JVM |
| `KEYCLOAK_TRUST_STORE_PASSWORD` | No | empty | Password for the optional Keycloak truststore |
| `KEYCLOAK_TRUST_STORE_TYPE` | No | `PKCS12` | Optional Keycloak truststore type |
| `APP_CUSTOMER_ROLE` | No | `customer` | Keycloak role representing customer users |
| `APP_CORPORATE_ROLE` | No | `corporate` | Keycloak role representing corporate users |
| `APP_LOG_FILE_PATH` | No | `logs/authservice.log` | Local file where structured application logs are written |
| `OTEL_SERVICE_NAME` | No | `authservice` | Service name used in OpenTelemetry resources |
| `OTEL_SERVICE_NAMESPACE` | No | `voyagevibes` | Service namespace attached to exported telemetry |
| `OTEL_TRACING_EXPORT_ENABLED` | No | `false` | Enable OTLP trace export |
| `OTEL_METRICS_EXPORT_ENABLED` | No | `false` | Enable OTLP metrics export |
| `OTEL_LOGS_EXPORT_ENABLED` | No | `false` | Enable OTLP log export |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | No | `http://localhost:4318/v1/traces` | OTLP traces endpoint |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | No | `http://localhost:4318/v1/metrics` | OTLP metrics endpoint |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | No | `http://localhost:4318/v1/logs` | OTLP logs endpoint |
| `DB_URL` | No | in-memory H2 | Database connection string |
| `DB_USERNAME` | No | `sa` | Database user |
| `DB_PASSWORD` | No | empty | Database password |
| `DB_DRIVER_CLASS_NAME` | No | `org.h2.Driver` | JDBC driver class |

## Logging

- Console output is intentionally short and readable.
- Structured file logs are written to `logs/authservice.log` by default.
- Override the log file destination with `APP_LOG_FILE_PATH`.
- Every API request is logged once with method, path, status, and latency.
- Trace and span ids are included in every log line so request logs, app logs, and distributed traces can be correlated quickly.
- Request bodies are not logged, which keeps auth tokens and personal data out of logs.

## OpenTelemetry

This service can export all three signals to an OTLP collector:

- traces through the Spring Boot and Micrometer OpenTelemetry bridge
- metrics through the Micrometer OTLP registry
- logs through the OpenTelemetry Logback appender and OTLP log exporter

To enable export, set these env vars:

- `OTEL_TRACING_EXPORT_ENABLED=true`
- `OTEL_METRICS_EXPORT_ENABLED=true`
- `OTEL_LOGS_EXPORT_ENABLED=true`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces`
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://otel-collector:4318/v1/logs`

These env vars bind into `app.observability.telemetry.*`, so telemetry remains optional and disabled until one or more export flags are set to `true`.

## Keycloak Connectivity Diagnosis

The last verification on May 2, 2026 showed that `keycloak.voyagevibes.in` resolved to `127.0.0.1`, but TCP port `8091` was not accepting connections from the host running this service.

Use one of these URLs instead of assuming the external HTTPS hostname is always up:

- local development from the host: `http://localhost:8090`
- Podman network service-to-service traffic: `http://keycloak:8080`
- HTTPS only when the endpoint is reachable and the JVM trusts its certificate chain

If you enable HTTPS against a private or self-signed Keycloak certificate, configure `KEYCLOAK_TRUST_STORE_PATH`, `KEYCLOAK_TRUST_STORE_PASSWORD`, and `KEYCLOAK_TRUST_STORE_TYPE` so the auth-service can trust that endpoint explicitly.

## Secure Connectivity

### Secure Keycloak via HTTPS

- The service already supports a Keycloak base URL over `https://`.
- Outbound Keycloak calls use JVM-managed TLS trust plus explicit connect and read timeouts.
- For private CA or self-signed certificates, import the CA into a Java truststore and point the service at it with `KEYCLOAK_TRUST_STORE_PATH`, `KEYCLOAK_TRUST_STORE_PASSWORD`, and `KEYCLOAK_TRUST_STORE_TYPE`.
- Production recommendation: keep `KEYCLOAK_URL` on HTTPS only and require MFA for privileged corporate roles.

### Secure PostgreSQL via TLS

- Use the PostgreSQL JDBC driver `org.postgresql:postgresql:42.7.11`.
- Preferred JDBC URL pattern:
  `jdbc:postgresql://platform-postgres:5432/authdb?sslmode=verify-full&sslrootcert=/certs/postgres-ca.crt`
- `sslmode=verify-full` validates both trust and hostname, so it is the strongest common configuration for this service.
- Mount the PostgreSQL CA certificate into the container or host and point `sslrootcert` to that file.
- For host-based local development, `jdbc:postgresql://localhost:5432/authdb?sslmode=disable` is the simplest starting point.
- Ensure the PostgreSQL database `authdb` and the login role used by this service exist before switching away from the default in-memory H2 profile.

## Health Checks

- `/health` is operational only when both `db` and `keycloak` are reachable.
- `/actuator/health/liveness` reports JVM liveness state.
- `/actuator/health/readiness` now includes `db` and `keycloak`.
- `/actuator/health/operational` exposes the same dependency-focused operational view through Actuator.
- `/actuator/health` exposes the same components with details when the caller is authorized.

## Redirect URI Clarification

`KEYCLOAK_DEFAULT_REDIRECT_URI` is a fallback callback URI used when the auth-code exchange request does not send a `redirectUri`.

- It is not an arbitrary redirect selected by this service.
- In OAuth2 authorization-code flow, Keycloak redirects the browser back to the same redirect URI that was used when login started.
- `swagger-ui/oauth2-redirect.html` is Swagger UI's standard callback page, so it is useful for docs-driven testing.
- Real frontends should send their own callback URI so the token exchange uses the exact redirect URI that Keycloak saw during authorization.

## Corporate Role Model

All workforce users authenticate through `/auth/corporate/login`, but their allowed actions should differ by Keycloak role claims.

| Role | Typical login source | Example capabilities |
| --- | --- | --- |
| `support-desk` | Corporate SSO or LDAP via Keycloak | View customer profile, investigate payment issues, start refund workflows |
| `booking-ops` | Corporate SSO or LDAP via Keycloak | Correct passenger details, reissue bookings, support cancellations |
| `finance-ops` | Corporate SSO or LDAP via Keycloak | Reconcile payments, review refunds, investigate chargebacks |
| `flight-admin` | Corporate SSO or LDAP via Keycloak | Update schedules, inventory, and operational flight metadata |
| `pricing-analyst` | Corporate SSO or LDAP via Keycloak | Review fares, campaigns, and commercial reports |
| `corporate-travel-manager` | Corporate SSO or external B2B IdP | Manage enterprise accounts and traveler support cases |
| `reporting-analyst` | Corporate SSO or LDAP via Keycloak | Read-only analytics and audit access |
| `super-admin` | Corporate SSO with MFA | Cross-domain administration and emergency support workflows |

Customer login is intentionally different:

- Customers authenticate through Google brokering or a customer-facing IdP and only receive self-service permissions.
- Corporate users authenticate through workforce federation and can receive additional operational roles beyond the base `corporate` role.
- This auth service enforces `customer` versus `corporate` at login time; downstream services should enforce the finer-grained workforce roles.

## Keycloak Realm JSON

The supported import is [`docs/keycloak/flight-booking-realm.json`](docs/keycloak/flight-booking-realm.json).

It matches the auth-service contract directly:

- one realm named `flight-booking`
- one customer login client: `flight-auth-service`
- one admin client: `flight-auth-admin`
- realm roles `customer`, `corporate`, `admin`, and the documented corporate workforce roles
- Google broker alias `google`
- `/customers` and `/corporate-users/*` groups that map identities onto the expected base roles

## API List

| Endpoint | Method | Description | User Type |
| --- | --- | --- | --- |
| `/auth/frontend-config` | `GET` | Public frontend configuration for Keycloak auth flows, PKCE, and corporate role catalog | Common |
| `/auth/customer/register` | `POST` | Exchange Keycloak auth code, validate customer access, and upsert local customer metadata | Customer |
| `/auth/customer/login` | `POST` | Exchange Keycloak auth code for customer tokens | Customer |
| `/auth/customer/logout` | `POST` | Revoke refresh token in Keycloak | Customer |
| `/auth/customer/{id}` | `DELETE` | Delete Keycloak customer and local metadata | Customer/Admin |
| `/auth/corporate/login` | `POST` | Exchange Keycloak auth code for corporate tokens | Corporate |
| `/auth/corporate/logout` | `POST` | Revoke refresh token in Keycloak | Corporate |
| `/auth/me` | `GET` | Resolve authenticated user details from Bearer token | Common |
| `/health` | `GET` | Operational health endpoint that returns `UP` only when DB and Keycloak are both reachable | Common |

## Frontend Integration

Frontend applications should use the auth service as the source of truth for login bootstrap metadata.

- Call `/auth/frontend-config` on app startup.
- Use `authorizationEndpoint` plus the flow-specific `authorizationParameters` to build the Keycloak authorize URL.
- Generate `state`, `nonce`, `redirect_uri`, and PKCE `code_challenge` in the frontend.
- Send the returned authorization code to `/auth/customer/login` or `/auth/corporate/login`.
- Use `/auth/me` after login to read `baseRole`, `roles`, and `corporateRoles` for UI decisions.

The auth service remains the source of truth only for base audience selection:

- `customer` means customer self-service session
- `corporate` means workforce session
- finer corporate permissions such as `support-desk` or `flight-admin` must still be enforced by downstream services

## Authentication Flow

### Customer

1. Frontend redirects the user to Keycloak.
2. Keycloak delegates login to Google.
3. Keycloak redirects back with an authorization code.
4. Frontend posts the code to `/auth/customer/register` for first login or `/auth/customer/login` for returning login.
5. This service exchanges the code with Keycloak, validates roles, and returns Keycloak tokens.

### Corporate

1. Frontend redirects the user to Keycloak.
2. Keycloak authenticates against LDAP, SSO, or another federated IdP.
3. Keycloak returns an authorization code.
4. Frontend posts the code to `/auth/corporate/login`.
5. This service exchanges the code, validates corporate roles, and returns Keycloak tokens.

## Swagger Access

- Swagger UI: `http://localhost:8081/swagger-ui`
- Customer docs: `http://localhost:8081/docs/customer`
- Corporate docs: `http://localhost:8081/docs/corporate`
- Operations docs: `http://localhost:8081/docs/operations`
- Docs redirect: `http://localhost:8081/docs`
- OpenAPI JSON: `http://localhost:8081/v3/api-docs`
- Static OpenAPI file: [`openapi.yaml`](openapi.yaml)

Swagger uses Bearer authentication for protected endpoints. Paste the Keycloak access token into the Authorize dialog as:

```text
Bearer <access_token>
```

The frontend bootstrap contract is also visible in Swagger through `/auth/frontend-config`.

## Sample Requests

Customer register:

```bash
curl -X POST http://localhost:8081/auth/customer/register \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationCode": "sample-auth-code",
    "redirectUri": "http://localhost:8081/swagger-ui/oauth2-redirect.html",
    "codeVerifier": "sample-pkce-verifier"
  }'
```

Customer login:

```bash
curl -X POST http://localhost:8081/auth/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationCode": "sample-auth-code",
    "redirectUri": "http://localhost:8081/swagger-ui/oauth2-redirect.html"
  }'
```

Corporate login:

```bash
curl -X POST http://localhost:8081/auth/corporate/login \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationCode": "sample-auth-code",
    "redirectUri": "http://localhost:8081/swagger-ui/oauth2-redirect.html"
  }'
```

Get current user:

```bash
curl http://localhost:8081/auth/me \
  -H "Authorization: Bearer <access-token>"
```

Logout:

```bash
curl -X POST http://localhost:8081/auth/customer/logout \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh-token>"
  }'
```

Delete customer:

```bash
curl -X DELETE http://localhost:8081/auth/customer/<keycloak-user-id> \
  -H "Authorization: Bearer <access-token>"
```

Health:

```bash
curl http://localhost:8081/health
```

## Kong API Configuration

This service assumes Kong sits in front of it. Recommended Kong responsibilities:

- TLS termination
- rate limiting
- request/response logging
- upstream auth route protection
- CORS where appropriate

Keep JWT validation in this service even when Kong is present so application-level role checks remain explicit and auditable.

The commands below configure Kong through the Admin API to expose this auth service on `/api/v1/auth`.

For the containerized Podman setup, Kong should point to the auth container directly:

```bash
export KONG_ADMIN_BASE_URL=http://localhost:8001
export AUTH_SERVICE_URL=http://auth-service:8081/auth
export CUSTOMER_API_HOST=customer-api.voyagevibes.in
export CORPORATE_API_HOST=corp-api.voyagevibes.in
```

For host-run local development instead of a containerized auth service, use:

```bash
export AUTH_SERVICE_URL=http://host.containers.internal:8081
```

Create or update the Kong service:

```bash
curl -i -X POST "$KONG_ADMIN_BASE_URL/services" \
  --data-urlencode "name=auth-service" \
  --data-urlencode "url=$AUTH_SERVICE_URL"
```

If `auth-service` already exists, update it instead:

```bash
curl -i -X PATCH "$KONG_ADMIN_BASE_URL/services/auth-service" \
  --data-urlencode "url=$AUTH_SERVICE_URL"
```

Create the localhost route used for local gateway testing:

```bash
curl -i -X POST "$KONG_ADMIN_BASE_URL/services/auth-service/routes" \
  --data-urlencode "name=auth-api-local" \
  --data-urlencode "hosts[]=localhost" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

If `auth-api-local` already exists, update it instead:

```bash
curl -i -X PATCH "$KONG_ADMIN_BASE_URL/routes/auth-api-local" \
  --data-urlencode "name=auth-api-local" \
  --data-urlencode "hosts[]=localhost" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

Create the customer-facing route:

```bash
curl -i -X POST "$KONG_ADMIN_BASE_URL/services/auth-service/routes" \
  --data-urlencode "name=customer-auth-api" \
  --data-urlencode "hosts[]=$CUSTOMER_API_HOST" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

If `customer-auth-api` already exists, update it instead:

```bash
curl -i -X PATCH "$KONG_ADMIN_BASE_URL/routes/customer-auth-api" \
  --data-urlencode "name=customer-auth-api" \
  --data-urlencode "hosts[]=$CUSTOMER_API_HOST" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

Create the corporate-facing route:

```bash
curl -i -X POST "$KONG_ADMIN_BASE_URL/services/auth-service/routes" \
  --data-urlencode "name=corp-auth-api" \
  --data-urlencode "hosts[]=$CORPORATE_API_HOST" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

If `corp-auth-api` already exists, update it instead:

```bash
curl -i -X PATCH "$KONG_ADMIN_BASE_URL/routes/corp-auth-api" \
  --data-urlencode "name=corp-auth-api" \
  --data-urlencode "hosts[]=$CORPORATE_API_HOST" \
  --data-urlencode "paths[]=/api/v1/auth" \
  --data-urlencode "strip_path=true"
```

Verify Kong configuration:

```bash
curl "$KONG_ADMIN_BASE_URL/services/auth-service"
curl "$KONG_ADMIN_BASE_URL/routes/auth-api-local"
curl "$KONG_ADMIN_BASE_URL/routes/customer-auth-api"
curl "$KONG_ADMIN_BASE_URL/routes/corp-auth-api"
```

Verify traffic through Kong:

```bash
curl -i -H "Host: localhost" http://localhost:8000/api/v1/auth/frontend-config
curl -i -H "Host: localhost" http://localhost:8000/api/v1/auth/me
curl -i -H "Host: customer-api.voyagevibes.in" http://localhost:8000/api/v1/auth/frontend-config
curl -i -H "Host: corp-api.voyagevibes.in" http://localhost:8000/api/v1/auth/frontend-config
```

Expected results:

- `/api/v1/auth/frontend-config` returns `200`
- `/api/v1/auth/me` returns `401` without a bearer token
