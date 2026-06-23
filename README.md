# Voyage Vibes - Flight booking app

## Makara Observer demo

The active frontend is a focused Makara Observer demo app. Open the UI, click
**Collect complete trace**, and use the returned trace ID in Makara to inspect
the complete path:

1. Browser span: `browser click: makara demo button`
2. Gateway request: `POST /api/v1/demo/button-click` through Kong
3. Backend span: `demo backend: receive button click`
4. Database spans: `database insert: demo_click_events` and
   `database read: demo_click_events count`
5. Browser response: event ID, trace ID, and total persisted demo events

Useful local defaults:

```sh
VITE_API_BASE_URL=/api/v1
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_TRACING_EXPORT_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

## Infrastructure

| Component | Database | http Port | https Port |
|-----------|----------|-----------|------------|
| Keycloak  | Postgres | 8090      | 8091       |

**Images used**
- [Keycloak]()  
registry.redhat.io/rhbk/keycloak-rhel9:26.2-15

### Observability

The default compose setup uses the local OpenTelemetry collector config at
`00-infraservices/observability/otel/config/otel-collector-config-local.yml`.
It exports telemetry to the local Tempo, Loki, Prometheus, and debug exporters.

To also export to the Makara OTLP gateway, run compose with the gateway config
and a certificate directory that contains `root-ca.crt`,
`voyagevibes-client.crt`, and `voyagevibes-client.key`:

```sh
MAKARA_OTEL_CONFIG_FILE=./config/otel-collector-config.yml \
MAKARA_OTEL_CERT_DIR=/path/to/otel-certs \
podman compose -f docker-compose.yml up -d
```

## Databases

| Component | Port     | Port outside container |
|-----------|----------|------------------------|
| Postgres  | 5432     | 5433                   |

**Images used for DB**  
- Postgres  
registry.redhat.io/rhel9/postgresql-16:latest

## Services

| Service                                     | DB port     | DB port outside container   | http port | https port |
|---------------------------------------------|-------------|-----------------------------|-----------|------------|
| [Auth service](./01-authservice/README.md)  | 5432        | 5433                        | 8081      | 7071       |

**Images used for services**

- Auth service  
registry.redhat.io/ubi9/openjdk-17@sha256:615a2e789a3b2d982ec9e126d525697032440b1eace5dfea4fe6618cc85a7935
