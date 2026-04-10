# Voyage Vibes

Polygot flight-booking demo with Podman/Compose deployment units for gateway, auth, flight, booking, customer, and payment services.

## Start the application

Compose-managed runtime variables now live in per-service dotenv files referenced by `env_file` instead of inline `environment` blocks. Compose units that contain multiple containers with overlapping variable names use separate `.env.*` files.

### In local containers

<!-- ```shell
# use docker or podman
COMPOSE_PARALLEL_RUN=1
podman compose -f docker-compose.yml up -d
``` -->

```shell
# Build & push apps in podman
CONTAINER_REPO=quay.io
CONTAINER_USERSPACE=mukeshs1306
APP_VERSION=v1.003

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-authservice:$APP_VERSION -f 01-authservice/docker/Containerfile 01-authservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-authservice:$APP_VERSION

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-flightservice:$APP_VERSION -f 02-flightservice/src/main/docker/Dockerfile.jvm 02-flightservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-flightservice:$APP_VERSION

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-bookingservice:$APP_VERSION -f 03-bookingservice/docker/Containerfile 03-bookingservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-bookingservice:$APP_VERSION

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-customerservice:$APP_VERSION -f 04-customerservice/docker/Containerfile 04-customerservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-customerservice:$APP_VERSION

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-paymentservice:$APP_VERSION -f 05-paymentservice/docker/Containerfile 05-paymentservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-paymentservice:$APP_VERSION

podman build -t $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-notificationservice:$APP_VERSION -f 06-notificationservice/docker/Containerfile 06-notificationservice/ && podman push $CONTAINER_REPO/$CONTAINER_USERSPACE/voyagevibes-notificationservice:$APP_VERSION
```

```shell
# use docker or podman
podman compose -f infra-docker-compose.yml up -d

podman compose -f observability-docker-compose.yml up -d

podman compose -f app-docker-compose.yml up -d
```


Databases are centralized in `00-infraservices/databases-docker-compose.yml` with a shared Postgres instance and a bootstrap init for Keycloak and Kong.

#### List of images used

**Apps**
```
# Dotnet
podman pull registry.redhat.io/rhel8/dotnet-80-runtime:latest
```
```
# Java 17
podman pull registry.redhat.io/ubi9/openjdk-17@sha256:615a2e789a3b2d982ec9e126d525697032440b1eace5dfea4fe6618cc85a7935
```
```
# Java 21
podman pull registry.access.redhat.com/ubi9/openjdk-21:1.23
```
```
# NodeJS
podman pull registry.redhat.io/ubi9/nodejs-22:9.7
```
```
# Python
podman pull registry.redhat.io/ubi9/python-39:9.7
```
```
# Golang
podman pull registry.redhat.io/ubi9/go-toolset:9.7
```

**Databases**
```
# Postgres
podman pull registry.redhat.io/rhel9/postgresql-16:latest
```
```
# MySQL
podman pull registry.redhat.io/rhel9/mysql-84:latest
```
```
# MSSQL
podman pull mcr.microsoft.com/mssql/rhel/server:2025-latest
```
```
# MongoDB
podman pull quay.io/mongodb/mongodb-community-server
```
```
# Redis
podman pull registry.redhat.io/rhel9/redis-7:9.7
```

**Gateway**
```
podman pull docker.io/library/kong
```

**Auth**
```
podman pull registry.redhat.io/rhbk/keycloak-rhel9:26.2-15
```

**Messaging service**
```
podman pull docker.io/apache/kafka:3.8.0
```

**Network tool**
```
podman pull registry.redhat.io/openshift4/network-tools-rhel9:v4.19
```

## Services

| Service | Compose file | Published host port(s) | Container port(s) | Notes |
|---|---|---|---|---|
| `platform_postgres` | `00-infraservices/databases-docker-compose.yml` | `5432` | `5432` | Shared Postgres for auth, payment, keycloak, kong, notification audit |
| `platform_mysql` | `00-infraservices/databases-docker-compose.yml` | `3306` | `3306` | Flight service database |
| `platform_mssql` | `00-infraservices/databases-docker-compose.yml` | `1433` | `1433` | Booking service database |
| `platform_mongodb` | `00-infraservices/databases-docker-compose.yml` | `27017` | `27017` | Customer service database |
| `platform_redis` | `00-infraservices/databases-docker-compose.yml` | `6380` | `6379` | Notification service Redis |
| `kong_gateway` | `00-infraservices/kong-gateway-docker-compose.yml` | `8000`, `8443`, `8001` | `8000`, `8443`, `8001` | Proxy HTTP, proxy HTTPS, admin API |
| `keycloak` | `00-infraservices/keycloak-docker-compose.yml` | `8090`, `8091` | `8080`, `8443` | Identity provider |
| `kafka` | `00-infraservices/kafka-docker-compose.yml` | `9192`, `9193` | `9192`, `9093` | Broker and controller |
| `opentelemetry-collector` | `00-infraservices/observability-docker-compose.yml` | `4317`, `4318`, `8888`, `8889` | `4317`, `4318`, `8888`, `8889` | OTLP and collector metrics |
| `prometheus` | `00-infraservices/observability-docker-compose.yml` | `9090` | `9090` | Metrics store |
| `loki` | `00-infraservices/observability-docker-compose.yml` | `3100` | `3100` | Logs store |
| `tempo` | `00-infraservices/observability-docker-compose.yml` | `3200`, `4320`, `4321` | `3200`, `4317`, `4318` | Trace store and OTLP ingest |
| `grafana` | `00-infraservices/observability-docker-compose.yml` | `3000` | `3000` | Dashboards |
| `auth-service` | `01-authservice/authservice-docker-compose.yml` | `8081` | `8081` | Assigned app port |
| `flight-service` | `02-flightservice/flightservice-docker-compose.yml` | `8082` | `8082` | Assigned app port |
| `booking-service` | `03-bookingservice/bookingservice-docker-compose.yml` | `8083` | `8083` | Assigned app port |
| `customer-service` | `04-customerservice/customerservice-docker-compose.yml` | `8084` | `8084` | Assigned app port |
| `payment-service` | `05-paymentservice/paymentservice-docker-compose.yml` | `8085` | `8085` | Assigned app port |
| `notification-service` | `06-notificationservice/notificationservice-docker-compose.yml` | `8086` | `8086` | Assigned app port |
| `customer-ui` | `voyagevibes-flight-booking/customer-ui-docker-compose.yml` | `9001` | `9001` | Customer UI HTTPS entrypoint |
| `corp-ui` | `voyagevibes-corp/corp-ui-docker-compose.yml` | `9002` | `9002` | Corp UI HTTPS entrypoint |

## Planned App Ports

| Service | Required port | Current status |
|---|---|---|
| `auth-service` | `8081` | aligned |
| `flight-service` | `8082` | aligned |
| `booking-service` | `8083` | aligned |
| `customer-service` | `8084` | aligned |
| `payment-service` | `8085` | aligned |
| `notification-service` | `8086` | aligned |
| `customer-ui` | `9001` | aligned |
| `corp-ui` | `9002` | aligned |

## Port Conflict Check

- No published host-port conflicts were found across the current compose files.
- The app services now publish only the planned ports `8081` through `8086`.
- The UIs now publish only `9001` and `9002`.
- Keycloak, Kong, databases, Kafka, and observability ports remain unchanged.

## Databases

- `platform_postgres` (PostgreSQL 16) shared by auth-service, payment-service, keycloak, and kong.
- `platform_mysql` (MySQL 8.4) used by flight-service.
- `platform_mssql` (SQL Server 2025) used by booking-service.
- `platform_mongodb` (MongoDB Community) used by customer-service.
- `platform_postgres_init` bootstraps Keycloak and Kong databases from `00-infraservices/init-db-files`.

## Kong Gateway

Kong is configured to expose:

| Port | Purpose |
|---|---|
| `8000` | HTTP proxy |
| `8443` | HTTPS proxy |
| `8001` | Admin API |

The gateway itself terminates TLS on `8443`. Downstream services can still be routed over their internal HTTP ports (`808X`) unless you explicitly register HTTPS upstream URLs.

## Run With Podman

```bash
podman compose -f docker-compose.yml up --build
```

If you prefer to bring up services individually, use the compose file in each service directory listed above.

## Observability (OpenTelemetry SDK)

Each service now initializes the OpenTelemetry SDK directly (logs, traces, metrics). To enable:

```bash
OTEL_ENABLED=true
OTEL_SDK_DISABLED=false
```

Default OTLP endpoints (per `.env`) point to the collector:
- gRPC: `http://opentelemetry-collector:4317`
- HTTP: `http://opentelemetry-collector:4318`

The UI (nginx) emits JSON access logs to a shared volume and the collector ingests access/error logs via `filelog`.

## UI Hostnames And TLS

- `voyagevibes-flight-booking` serves on `https://customer-ui.voyagevibes.in:9001` using certs from `voyagevibes-flight-booking/https-certs`
- `voyagevibes-corp` serves on `https://corp-ui.voyagevibes.in:9002` using certs from `voyagevibes-corp/https-certs`
- Keycloak is exposed as `https://keycloak.voyagevibes.in:8091`

Add these host mappings locally before testing:

```text
127.0.0.1 customer-ui.voyagevibes.in
127.0.0.1 corp-ui.voyagevibes.in
127.0.0.1 keycloak.voyagevibes.in
```

For Google OAuth in GCP, configure the production redirect URI as:

```text
https://keycloak.voyagevibes.in:8091/realms/voyagevibes-public/broker/google/endpoint
```

Google OAuth notes:

- This redirect URI belongs in the Google OAuth client configuration, not the UI callback URL.
- The public Keycloak client callback stays `https://customer-ui.voyagevibes.in:9001/auth/google/callback`.
- The corp Keycloak client callback stays `https://corp-ui.voyagevibes.in:9002/corp/auth/callback`.

## Runtime Environment Conventions

Shared listener conventions across services:

- App service ports: `8081` through `8086`
- UI ports: `9001` and `9002`
- Keycloak ports: `8090` and `8091`
- Kong ports: `8000`, `8443`, and `8001`
- Bind address: `0.0.0.0`

Service-specific compose wiring now includes:

- `auth-service`: `AUTHSERVICE_HTTP_PORT`, `AUTHSERVICE_BIND_ADDRESS`, `AUTH_DB_*`, Keycloak envs
- `flight-service`: `HTTP_PORT`, `QUARKUS_HTTP_HOST`, `MYSQL_*`, `KAFKA_*`
- `booking-service`: `HTTP_PORT`, `KAFKA__*`, `EXTERNALSERVICES__FLIGHT__*`
- `customer-service`: `HTTP_PORT`, `SERVER_HOST`, `MONGODB_*`, `KAFKA_*`
- `payment-service`: `HTTP_PORT`, `SERVER_HOST`, `PAYMENT_DB_*`, `KAFKA_*`
- `notification-service`: `HTTP_PORT`, `KAFKA_*`, `REDIS_*`, `POSTGRES_*`, `DEDUP_*`, `THROTTLE_*`, `RETRY_MAX_ATTEMPTS`, `EVENT_SOURCE`

## OpenTelemetry (Shared)

All services read these variables when SDK export is enabled:

| Variable | Purpose |
|---|---|
| `OTEL_ENABLED` | Toggle SDK export (`true` / `false`) |
| `OTEL_SDK_DISABLED` | Disable flag (`true` disables) |
| `OTEL_SERVICE_NAME` | Service name for resource |
| `OTEL_RESOURCE_ATTRIBUTES` | Optional resource attributes |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` or `http` |

## Environment Variables By Application

The list below reflects the variables currently consumed by application code or compose wiring in this repo.

### Kong Gateway

| Variable | Purpose |
|---|---|
| `KONG_DATABASE` | Kong storage backend |
| `KONG_PG_HOST` | Kong Postgres host |
| `KONG_PG_DATABASE` | Kong Postgres database |
| `KONG_PG_USER` | Kong Postgres user |
| `KONG_PG_PASSWORD` | Kong Postgres password |
| `KONG_PROXY_ACCESS_LOG` | Proxy access log target |
| `KONG_ADMIN_ACCESS_LOG` | Admin API access log target |
| `KONG_ADMIN_LISTEN` | Admin API bind address |
| `KONG_DNS_ORDER` | DNS lookup order |
| `KONG_LOG_LEVEL` | Kong log verbosity |
| `KONG_PROXY_LISTEN` | HTTP and HTTPS listener config |
| `KONG_SSL_CERT` | Kong TLS certificate path |
| `KONG_SSL_CERT_KEY` | Kong TLS private key path |

### Keycloak

| Variable | Purpose |
|---|---|
| `KEYCLOAK_DB_NAME` | Keycloak database name for shared Postgres bootstrap |
| `KEYCLOAK_DB_USER` | Keycloak database user for shared Postgres bootstrap |
| `KEYCLOAK_DB_PASSWORD` | Keycloak database password for shared Postgres bootstrap |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | Bootstrap admin username |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | Bootstrap admin password |
| `KC_HOSTNAME` | Public Keycloak hostname |
| `KC_HOSTNAME_STRICT` | Enforce strict hostname handling |
| `KC_DB` | Keycloak DB vendor |
| `KC_DB_URL` | JDBC URL for Keycloak DB |
| `KC_DB_USERNAME` | Keycloak DB user |
| `KC_DB_PASSWORD` | Keycloak DB password |
| `KC_HTTP_ENABLED` | Enable HTTP listener |
| `KC_PROXY_HEADERS` | Proxy header mode |
| `KC_HTTPS_KEY_STORE_FILE` | HTTPS keystore file path |
| `KC_HTTPS_KEY_STORE_PASSWORD` | HTTPS keystore password |
| `KC_HTTPS_KEY_STORE_TYPE` | HTTPS keystore type |
| `KC_HEALTH_ENABLED` | Enable health endpoints |
| `KC_METRICS_ENABLED` | Enable metrics endpoints |
| `KC_LOG_LEVEL` | Log verbosity |

### Auth Service

| Variable | Purpose |
|---|---|
| `APP_ENV` | Active app profile |
| `AUTHSERVICE_HTTP_PORT` | HTTP listener port |
| `AUTHSERVICE_HTTPS_PORT` | HTTPS listener port |
| `AUTHSERVICE_BIND_ADDRESS` | Bind address |
| `AUTHSERVICE_HOSTNAME` | Public auth hostname |
| `AUTHSERVICE_APP_BASE_URL` | Public auth base URL |
| `AUTH_DB_URL` | Auth DB JDBC URL |
| `AUTH_DB_USERNAME` | Auth DB username |
| `AUTH_DB_PASSWORD` | Auth DB password |
| `SERVER_SSL_ENABLED` | Enable TLS |
| `SERVER_SSL_KEY_STORE` | TLS keystore path |
| `SERVER_SSL_KEY_STORE_PASSWORD` | TLS keystore password |
| `SERVER_SSL_KEY_STORE_TYPE` | TLS keystore type |
| `KEYCLOAK_BASE_URL` | Internal Keycloak base URL |
| `KEYCLOAK_PUBLIC_BASE_URL` | Public Keycloak base URL |
| `KEYCLOAK_PUBLIC_REALM` | Public realm name |
| `KEYCLOAK_CLIENT_ID_PUBLIC` | Public client id |
| `KEYCLOAK_CLIENT_SECRET_PUBLIC` | Public client secret |
| `PUBLIC_REDIRECT_URI` | Customer UI OAuth callback |
| `GOOGLE_IDP_ALIAS` | Google broker alias |
| `KEYCLOAK_CORP_REALM` | Corp realm name |
| `KEYCLOAK_CLIENT_ID_CORP` | Corp client id |
| `KEYCLOAK_CLIENT_SECRET_CORP` | Corp client secret |
| `CORP_REDIRECT_URI` | Corp UI OAuth callback |

### Flight Service

| Variable | Purpose |
|---|---|
| `HTTP_PORT` | HTTP listener port |
| `HTTPS_PORT` | HTTPS listener port |
| `QUARKUS_HTTP_HOST` | Bind address |
| `QUARKUS_HTTP_INSECURE_REQUESTS` | HTTP alongside HTTPS |
| `SERVER_SSL_CERTIFICATE` | TLS certificate path |
| `SERVER_SSL_CERTIFICATE_PRIVATE_KEY` | TLS private key path |
| `LOCAL_CERTS_DIR` | Local cert directory fallback |
| `MYSQL_USER` | MySQL username |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_JDBC_URL` | MySQL JDBC URL |
| `FLIGHT_DB_INIT_SCRIPT` | DB init script path |
| `FLIGHT_DB_INIT_ENABLED` | Enable DB init logic |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka bootstrap servers |
| `FLIGHT_KAFKA_INVENTORY_TOPIC` | Inventory event topic |
| `BOOKING_KAFKA_TOPIC` | Booking event topic consumed by flight-service |
| `BOOKING_EVENTS_CONSUMER_GROUP` | Kafka consumer group |
| `BOOKING_EVENTS_AUTO_OFFSET_RESET` | Consumer offset reset mode |

### Booking Service

| Variable | Purpose |
|---|---|
| `APP_ENV` | Active appsettings profile |
| `HTTP_PORT` | HTTP listener port |
| `PORT` | HTTP fallback port |
| `HTTPS_PORT` | HTTPS listener port |
| `SERVER_SSL_ENABLED` | Enable TLS |
| `SERVER_SSL_CERTIFICATE` | TLS certificate path |
| `SERVER_SSL_CERTIFICATE_PRIVATE_KEY` | TLS private key path |
| `KAFKA__ENABLED` | Enable Kafka integration |
| `KAFKA__BOOTSTRAPSERVERS` | Kafka bootstrap servers |
| `EXTERNALSERVICES__FLIGHT__BASEURL` | Flight-service base URL |
| `EXTERNALSERVICES__FLIGHT__ALLOWINSECURETLS` | Disable TLS validation for flight-service client |

### Customer Service

| Variable | Purpose |
|---|---|
| `HTTP_PORT` | HTTP listener port |
| `PORT` | HTTP fallback port |
| `SERVER_PORT` | Alternate HTTP port fallback |
| `HTTPS_PORT` | HTTPS listener port |
| `SERVER_HOST` | Bind address |
| `LISTEN_HOST` | Alternate bind address |
| `PUBLIC_HOST` | Public hostname |
| `PUBLIC_BASE_URL` | Alternate public base URL |
| `SERVICE_PUBLIC_URL` | Alternate public base URL |
| `SERVER_SSL_ENABLED` | Enable TLS |
| `HTTPS_ENABLED` | Alternate TLS toggle |
| `SERVER_SSL_CERT_HOST` | Cert hostname override |
| `SERVER_SSL_CERT_BASENAME` | Cert file basename |
| `SERVER_SSL_CERT_DIR` | Cert directory |
| `TLS_CERT_DIR` | Alternate cert directory |
| `SERVER_SSL_CERTIFICATE` | TLS certificate path |
| `SERVER_SSL_CERTIFICATE_PRIVATE_KEY` | TLS private key path |
| `AUTHSERVICE_BASE_URL` | Auth-service base URL |
| `AUTH_SERVICE_BASE_URL` | Alternate auth-service base URL |
| `MONGODB_ENABLED` | Enable Mongo persistence |
| `MONGODB_REQUIRED` | Fail startup if Mongo is unavailable |
| `MONGODB_URI` | Full Mongo URI override |
| `MONGODB_HOST` | Mongo host |
| `MONGODB_PORT` | Mongo port |
| `MONGODB_USER` | Mongo user |
| `MONGODB_PASSWORD` | Mongo password |
| `MONGODB_DATABASE` | Mongo database name |
| `MONGODB_AUTH_SOURCE` | Mongo auth DB |
| `MONGODB_APP_NAME` | Mongo client app name |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | Mongo server selection timeout |
| `MONGODB_MAX_POOL_SIZE` | Mongo max pool size |
| `MONGODB_MIN_POOL_SIZE` | Mongo min pool size |
| `MONGODB_DIRECT_CONNECTION` | Direct-connection toggle |
| `MONGODB_INITDB_ROOT_USERNAME` | Mongo root user fallback |
| `MONGODB_INITDB_ROOT_PASSWORD` | Mongo root password fallback |
| `KAFKA_ENABLED` | Enable Kafka integration |
| `KAFKA_REQUIRED` | Fail startup if Kafka is unavailable |
| `KAFKA_CLIENT_ID` | Kafka client id |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka bootstrap servers |
| `KAFKA_CONSUMER_GROUP_ID` | Kafka consumer group |
| `KAFKA_AUTO_OFFSET_RESET` | Consumer offset reset mode |
| `KAFKA_SSL_ENABLED` | Enable Kafka SSL |
| `KAFKA_SASL_USERNAME` | Kafka SASL username |
| `KAFKA_SASL_PASSWORD` | Kafka SASL password |
| `KAFKA_SASL_MECHANISM` | Kafka SASL mechanism |
| `KAFKA_PRODUCE_NOTIFICATION_EVENTS` | Enable notification event publishing |
| `KAFKA_BOOKING_EVENTS_TOPIC` | Booking event topic |
| `KAFKA_PAYMENT_EVENTS_TOPIC` | Payment event topic |
| `KAFKA_INVENTORY_EVENTS_TOPIC` | Inventory event topic |
| `KAFKA_NOTIFICATION_EVENTS_TOPIC` | Notification event topic |
| `KAFKA_EVENT_SOURCE` | Event source name |

### Payment Service

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | Default provider name |
| `PAYMENT_STORAGE_BACKEND` | Repository backend selection |
| `PAYMENT_DB_DSN` | Postgres DSN |
| `DATABASE_URL` | Alternate Postgres DSN |
| `PAYMENT_DB_SCHEMA` | Postgres schema |
| `PAYMENT_DB_POOL_MIN_SIZE` | DB min pool size |
| `PAYMENT_DB_POOL_MAX_SIZE` | DB max pool size |
| `RAZORPAY_KEY_ID` | Razorpay public key id |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `HTTP_PORT` | HTTP listener port |
| `PORT` | HTTP fallback port |
| `SERVER_PORT` | Alternate HTTP port fallback |
| `HTTPS_PORT` | HTTPS listener port |
| `SERVER_SSL_ENABLED` | Enable TLS |
| `HTTPS_ENABLED` | Alternate TLS toggle |
| `SERVER_HOST` | Bind address |
| `LISTEN_HOST` | Alternate bind address |
| `PUBLIC_HOST` | Public hostname |
| `PUBLIC_BASE_URL` | Alternate public base URL |
| `SERVICE_PUBLIC_URL` | Alternate public base URL |
| `SERVER_SSL_CERT_BASENAME` | Cert basename |
| `SERVER_SSL_CERT_DIR` | Cert directory |
| `TLS_CERT_DIR` | Alternate cert directory |
| `SERVER_SSL_CERTIFICATE` | TLS certificate path |
| `SERVER_SSL_CERTIFICATE_PRIVATE_KEY` | TLS private key path |
| `KAFKA_ENABLED` | Enable Kafka integration |
| `KAFKA_REQUIRED` | Fail startup if Kafka is unavailable |
| `KAFKA_CLIENT_ID` | Kafka client id |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka bootstrap servers |
| `KAFKA_CONSUMER_GROUP_ID` | Kafka consumer group |
| `KAFKA_AUTO_OFFSET_RESET` | Consumer offset reset mode |
| `KAFKA_BOOKING_EVENTS_TOPIC` | Booking event topic |
| `KAFKA_PAYMENT_EVENTS_TOPIC` | Payment event topic |
| `KAFKA_ENSURE_TOPICS` | Auto-create topics |
| `KAFKA_TOPIC_PARTITIONS` | Topic partition count when ensuring topics |
| `KAFKA_TOPIC_REPLICATION_FACTOR` | Topic replication factor when ensuring topics |

### Notification Service

| Variable | Purpose |
|---|---|
| `HTTP_HOST` | HTTP bind address |
| `HTTP_PORT` | HTTP listener port |
| `HTTPS_ENABLED` | Enable HTTPS listener |
| `TLS_CERT_FILE` | TLS certificate file path |
| `TLS_KEY_FILE` | TLS private key file path |
| `KAFKA_ENABLED` | Enable Kafka integration |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka bootstrap servers |
| `KAFKA_CONSUMER_GROUP_ID` | Kafka consumer group |
| `KAFKA_BOOKING_EVENTS_TOPIC` | Booking event topic |
| `KAFKA_PAYMENT_EVENTS_TOPIC` | Payment event topic |
| `KAFKA_INVENTORY_EVENTS_TOPIC` | Inventory event topic |
| `KAFKA_NOTIFICATION_EVENTS_TOPIC` | Notification event topic |
| `REDIS_ADDR` | Redis address |
| `REDIS_PASSWORD` | Redis password |
| `REDIS_DB` | Redis database index |
| `DEDUP_TTL_SECONDS` | Deduplication TTL in seconds |
| `THROTTLE_MAX` | Max notifications per window |
| `THROTTLE_WINDOW_SECONDS` | Throttle window in seconds |
| `RETRY_MAX_ATTEMPTS` | Max retry attempts for failed publishes |
| `POSTGRES_ENABLED` | Enable Postgres audit trail |
| `POSTGRES_DSN` | Postgres DSN for audit |
| `EVENT_SOURCE` | Event source identifier |

### Customer UI

| Variable | Purpose |
|---|---|
| `VITE_GATEWAY_API_URL` | Gateway API base URL |
| `VITE_API_GATEWAY_BASE_URL` | Alternate gateway API base URL |
| `VITE_AUTH_API_URL` | Direct auth API base URL |
| `VITE_FLIGHT_API_URL` | Direct flight API base URL |
| `VITE_BOOKING_API_URL` | Direct booking API base URL |
| `VITE_CUSTOMER_API_URL` | Direct customer API base URL |
| `VITE_PAYMENT_API_URL` | Direct payment API base URL fallback |
| `VITE_PAYMENT_PROVIDER` | Preferred provider, for example `razorpay` |
| `VITE_GATEWAY_PROXY_TARGET` | Dev proxy target for `/gateway-api` |
| `VITE_AUTH_PROXY_TARGET` | Dev proxy target for `/auth-api` |
| `VITE_FLIGHT_PROXY_TARGET` | Dev proxy target for `/flight-api` |
| `VITE_BOOKING_PROXY_TARGET` | Dev proxy target for `/booking-api` |
| `VITE_CUSTOMER_PROXY_TARGET` | Dev proxy target for `/customer-api` |
| `VITE_PAYMENT_PROXY_TARGET` | Dev proxy target for `/payment-api` |
| `UI_TLS_CERT_PATH` | Vite dev TLS certificate path |
| `UI_TLS_KEY_PATH` | Vite dev TLS private key path |

### Corp UI

| Variable | Purpose |
|---|---|
| `PORT` | SSR or node-hosted port in `src/server.ts` |
<!-- | `pm_id` | PM2 process marker used to decide whether to boot the node server | -->

## Gateway-First Payment API Verification

Both UIs now send payment operations to Kong first:

- customer UI `payment` service key now resolves to `/gateway-api` first, with `/payment-api` kept as fallback
- corp UI `payment` service key now resolves to `/gateway-api` first, with `/corp-payment-api` kept as fallback

Kong must have the payment service and routes registered before those gateway calls can succeed. If Kong starts empty, register:

```bash
curl -i -X POST http://localhost:8001/services --data "name=payment-service" --data "url=http://payment-service:8085"
curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=customer-payment-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=corp-payment-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false"
```

## Implemented Endpoints

### Auth Service

| Method | Path |
|---|---|
| `GET` | `/api/v1/health` |
| `GET` | `/api/v1/health/live` |
| `GET` | `/api/v1/health/ready` |
| `GET` | `/api/v1/auth/public/google/start` |
| `GET` | `/api/v1/auth/public/google/callback` |
| `POST` | `/api/v1/auth/public/logout` |
| `POST` | `/api/v1/auth/public/step-up/otp/request` |
| `POST` | `/api/v1/auth/public/step-up/otp/verify` |
| `POST` | `/api/v1/auth/corp/login/init` |
| `POST` | `/api/v1/auth/corp/login/verify` |
| `POST` | `/api/v1/auth/corp/mfa/challenge` |
| `POST` | `/api/v1/auth/corp/mfa/verify` |
| `POST` | `/api/v1/auth/corp/logout` |
| `POST` | `/api/v1/auth/token/refresh` |
| `POST` | `/api/v1/auth/logout` |
| `GET` | `/api/v1/sessions/me` |
| `DELETE` | `/api/v1/sessions/me/{sessionId}` |
| `GET` | `/api/v1/users/me` |
| `PATCH` | `/api/v1/users/me` |
| `POST` | `/api/v1/corp/users` |
| `PATCH` | `/api/v1/corp/users/{id}` |
| `POST` | `/api/v1/corp/users/{id}/enable` |
| `POST` | `/api/v1/corp/users/{id}/disable` |
| `POST` | `/api/v1/corp/users/{id}/roles` |
| `DELETE` | `/api/v1/corp/users/{id}/roles/{roleId}` |
| `POST` | `/api/v1/corp/users/{id}/force-mfa-reset` |
| `POST` | `/api/v1/corp/users/{id}/session-revoke` |

### Flight Service

| Method | Path |
|---|---|
| `GET` | `/api/v1/health` |
| `GET` | `/api/v1/health/live` |
| `GET` | `/api/v1/health/ready` |
| `GET` | `/api/v1/flights/search` |
| `GET` | `/api/v1/flights/{flightId}` |
| `GET` | `/api/v1/flights/{flightId}/availability` |
| `POST` | `/api/v1/pricing/quote` |
| `POST` | `/api/v1/inventory/hold` |
| `POST` | `/api/v1/inventory/release` |
| `POST` | `/api/v1/inventory/commit` |

### Booking Service

| Method | Path |
|---|---|
| `GET` | `/api/v1/health` |
| `GET` | `/api/v1/health/live` |
| `GET` | `/api/v1/health/ready` |
| `POST` | `/api/v1/bookings/reserve` |
| `POST` | `/api/v1/bookings/{bookingId}/confirm` |
| `GET` | `/api/v1/bookings/{bookingId}` |
| `GET` | `/api/v1/bookings` |
| `POST` | `/api/v1/bookings/{bookingId}/cancel` |
| `POST` | `/api/v1/bookings/{bookingId}/change` |

### Customer Service

| Method | Path |
|---|---|
| `GET` | `/api/v1/health` |
| `GET` | `/api/v1/health/live` |
| `GET` | `/api/v1/health/ready` |
| `GET` | `/api/v1/users/me` |
| `PATCH` | `/api/v1/users/me` |
| `POST` | `/api/v1/users/me/mobile/verify/request` |
| `POST` | `/api/v1/users/me/mobile/verify/confirm` |
| `POST` | `/api/v1/notifications/email` |
| `POST` | `/api/v1/notifications/sms` |
| `POST` | `/api/v1/notifications/push` |
| `POST` | `/api/v1/sync/booking-events` |
| `POST` | `/api/v1/sync/payment-events` |
| `POST` | `/api/v1/sync/inventory-events` |

### Payment Service

| Method | Path |
|---|---|
| `GET` | `/api/v1/health` |
| `GET` | `/api/v1/health/live` |
| `GET` | `/api/v1/health/ready` |
| `POST` | `/api/v1/payments/intent` |
| `POST` | `/api/v1/payments/{paymentId}/authorize` |
| `POST` | `/api/v1/payments/{paymentId}/capture` |
| `POST` | `/api/v1/payments/{paymentId}/refund` |
| `POST` | `/api/v1/payments/webhooks/provider` |

## Kong Admin Examples

Register upstream services against the internal HTTP ports:

```bash
curl -i -X POST http://localhost:8001/services --data "name=auth-service" --data "url=http://auth-service:8081"
curl -i -X POST http://localhost:8001/services --data "name=flight-service" --data "url=http://flight-service:8082"
curl -i -X POST http://localhost:8001/services --data "name=booking-service" --data "url=http://booking-service:8083"
curl -i -X POST http://localhost:8001/services --data "name=customer-service" --data "url=http://customer-service:8084"
curl -i -X POST http://localhost:8001/services --data "name=payment-service" --data "url=http://payment-service:8085"
```

Register customer-facing routes:

```bash
curl -i -X POST http://localhost:8001/services/auth-service/routes --data "name=customer-auth-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/auth" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/flight-service/routes --data "name=customer-flight-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/flights" --data "paths[]=/api/v1/pricing" --data "paths[]=/api/v1/inventory" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/booking-service/routes --data "name=customer-booking-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/bookings" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/customer-service/routes --data "name=customer-profile-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/users" --data "paths[]=/api/v1/notifications" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=customer-payment-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false"
```

Register corp-facing routes:

```bash
curl -i -X POST http://localhost:8001/services/auth-service/routes --data "name=corp-auth-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/auth" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/flight-service/routes --data "name=corp-flight-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/flights" --data "paths[]=/api/v1/pricing" --data "paths[]=/api/v1/inventory" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/booking-service/routes --data "name=corp-booking-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/bookings" --data "strip_path=false"
curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=corp-payment-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false"
```

Verify through Kong HTTPS:

```bash
curl -k -i -H "Host: customer-api.voyagevibes.in" "https://localhost:8443/api/v1/flights/search?from=DEL&to=BOM&date=2026-03-07"
curl -k -i -H "Host: corp-api.voyagevibes.in" -H "Content-Type: application/json" -X POST https://localhost:8443/api/v1/auth/corp/login/init --data "{\"email\":\"staff@airline.com\",\"deviceInfo\":{\"userAgent\":\"curl\",\"ip\":\"127.0.0.1\",\"deviceId\":\"corp-cli-1\",\"platform\":\"windows\"}}"
```



<!-- Configure in hosts file
127.0.0.1 ui.voyagevibes.in
127.0.0.1 auth.voyagevibes.in
127.0.0.1 flight.voyagevibes.in
127.0.0.1 booking.voyagevibes.in
127.0.0.1 customer.voyagevibes.in
127.0.0.1 payment.voyagevibes.in
127.0.0.1 keycloak.voyagevibes.in
127.0.0.1 gateway.voyagevibes.in
127.0.0.1 customer-api.voyagevibes.in
127.0.0.1 corp-api.voyagevibes.in -->





<!-- curl -i -X POST http://localhost:8001/services --data "name=auth-service" --data "url=http://auth-service:8081" && curl -i -X POST http://localhost:8001/services/auth-service/routes --data "name=customer-auth-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/auth" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/auth-service/routes --data "name=corp-auth-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/auth" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services --data "name=flight-service" --data "url=http://flight-service:8082" && curl -i -X POST http://localhost:8001/services --data "name=booking-service" --data "url=http://booking-service:8083" && curl -i -X POST http://localhost:8001/services --data "name=customer-service" --data "url=http://customer-service:8084" && curl -i -X POST http://localhost:8001/services --data "name=payment-service" --data "url=http://payment-service:8085" && curl -i -X POST http://localhost:8001/services/flight-service/routes --data "name=customer-flight-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/flights" --data "paths[]=/api/v1/pricing" --data "paths[]=/api/v1/inventory" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/booking-service/routes --data "name=customer-booking-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/bookings" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/customer-service/routes --data "name=customer-profile-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/users" --data "paths[]=/api/v1/notifications" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=customer-payment-api" --data "hosts[]=customer-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/flight-service/routes --data "name=corp-flight-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/flights" --data "paths[]=/api/v1/pricing" --data "paths[]=/api/v1/inventory" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/booking-service/routes --data "name=corp-booking-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/bookings" --data "strip_path=false" && curl -i -X POST http://localhost:8001/services/payment-service/routes --data "name=corp-payment-api" --data "hosts[]=corp-api.voyagevibes.in" --data "paths[]=/api/v1/payments" --data "strip_path=false" -->

<!-- [text](../flight-booking/00-localtest-certs/notification.voyagevibes.in.pfx) [text](../flight-booking/00-localtest-certs/notification.voyagevibes.in.p12) [text](../flight-booking/00-localtest-certs/notification.voyagevibes.in.key.pem) [text](../flight-booking/00-localtest-certs/notification.voyagevibes.in.crt.pem) [text](../flight-booking/00-localtest-certs/notification.voyagevibes.in.cer) -->



