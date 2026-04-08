# Flight Service (`8082`)

Quarkus service for flight search, availability, pricing, and inventory hold lifecycle.

## Scope Implemented
- `GET /api/v1/flights/search`
- `GET /api/v1/flights/{flightId}`
- `GET /api/v1/flights/{flightId}/availability`
- `POST /api/v1/pricing/quote`
- `POST /api/v1/inventory/hold`
- `POST /api/v1/inventory/release`
- `POST /api/v1/inventory/commit`
- `GET /api/v1/health`, `/live`, `/ready`

## Swagger UI
Swagger UI is available at:
- `http://localhost:8082/swagger-ui`
- `https://flight.voyagevibes.in:8082/swagger-ui`

OpenAPI spec is available at:
- `http://localhost:8082/q/openapi`
- `https://flight.voyagevibes.in:8082/q/openapi`

The UI groups the API by:
- Flights
- Pricing
- Inventory
- Health

It also documents the main integrations used by this service:
- MySQL for flight catalog and seat inventory
- Kafka publish topic `flight.inventory.events`
- Kafka consume topic `booking.events`

## Actor Split (Customer vs Corp)
Aligned with `auth-service` model (`PUBLIC` customer realm and `CORP` corporate realm).

Headers accepted:
- `X-Actor-Type`: `customer` or `corp`
- `X-Realm` (fallback if actor header is missing): `PUBLIC`/`voyagevibes-public` -> customer, `CORP`/`voyagevibes-corp` -> corp
- `X-User-Id`: used for hold ownership checks

Default behavior when headers are absent:
- Actor defaults to `customer`
- User defaults to `U-DEFAULT`

### Policy Differences
- Customer:
  - Can release/commit only their own hold (`X-User-Id` ownership check).
- Corp:
  - Can release/commit any hold.

### Shared Flight Rules
- Search/get/availability behavior is the same for customer and corp actors.
- Quote uses flight fare without actor-specific discount.
- Hold TTL is `15 minutes` for all actors.
- `seatCount` must be positive and cannot exceed currently available seats.

## Inventory/Hold Lifecycle
- Hold operation reserves seats immediately.
- Release returns seats back to inventory.
- Commit finalizes the held seats for booking.
- Expired holds are auto-cleaned during API calls and seats are restored.

## Error Model
API returns JSON error body with `{ "code", "message" }`.

HTTP status mapping:
- `400` validation/request errors
- `403` actor authorization errors
- `404` flight/hold not found
- `409` business conflicts (insufficient seats, expired/released hold transitions)

## Run
```bash
./mvnw quarkus:dev
```

## Profiles
- `%dev`
  - Used by `./mvnw quarkus:dev`
  - Defaults: HTTPS preferred (`insecure-requests=disabled` unless overridden)
  - DB init default: enabled
- `%prod`
  - Used when running packaged app (`java -jar target/quarkus-app/quarkus-run.jar`)
  - Defaults: HTTPS only (`insecure-requests=disabled`)
  - DB init default: disabled

There is no `quarkus:prod` Maven goal.

## Local TLS Run (`flight.voyagevibes.in`)
- Cert directory used by default: `../00-localtest-certs`
- Default cert files used by service:
  - `../00-localtest-certs/flight.voyagevibes.in.crt.pem`
  - `../00-localtest-certs/flight.voyagevibes.in.key.pem`
- HTTPS is enabled on port `8082`.

Add host mapping (as Administrator):
```text
127.0.0.1 flight.voyagevibes.in
```

Run:
```bash
./mvnw quarkus:dev
```

Open:
```text
https://flight.voyagevibes.in:8082/api/v1/health
```

Troubleshooting:
- Use exact host `flight.voyagevibes.in` (not `flight.voyagervibes.in`).
- Ensure hosts entry exists:
  - `127.0.0.1 flight.voyagevibes.in`
- In dev profile, expected startup ports are:
  - `http://localhost:9090`
  - `https://localhost:8082`

Override cert path if needed:
```bash
set LOCAL_CERTS_DIR=..\00-localtest-certs
```

Force HTTPS-only even in dev:
```bash
set QUARKUS_HTTP_INSECURE_REQUESTS=disabled
./mvnw quarkus:dev
```

## Prod Profile Local Testing
```bash
./mvnw -DskipTests package
java -jar target/quarkus-app/quarkus-run.jar
```

Optional explicit profile flag:
```bash
java -Dquarkus.profile=prod -jar target/quarkus-app/quarkus-run.jar
```

## Build/Test
```bash
./mvnw test
./mvnw package
```

## MySQL Setup
- Datasource is enabled via `quarkus.datasource.*` properties in `src/main/resources/application.properties`.
- Service startup runs SQL bootstrap script from:
  - `src/main/resources/db/init-flight-db.sql`
  - Script is idempotent and does not overwrite existing inventory counts.
- Bootstrap flags:
  - `FLIGHT_DB_INIT_ENABLED=true|false` (default `true`)
  - `FLIGHT_DB_INIT_SCRIPT=db/init-flight-db.sql` (default script path)

Manual init command (if needed):
```bash
mysql -h localhost -u root -p flight_booking < src/main/resources/db/init-flight-db.sql
```

## Kafka Event Flow
This service uses Kafka for async cross-service consistency around inventory and booking lifecycle.

### Current implementation in `flight-service`
- Produces to: `flight.inventory.events`
- Consumes from: `booking.events`
- Produced event types:
  - `INVENTORY_HELD` after `POST /api/v1/inventory/hold`
  - `INVENTORY_RELEASED` after `POST /api/v1/inventory/release`
  - `INVENTORY_COMMITTED` after `POST /api/v1/inventory/commit`
  - `INVENTORY_EXPIRED` when hold TTL expiry auto-releases seats
- Consumed booking event types:
  - `BOOKING_CANCELLED` / `BOOKING_CANCELED` -> release inventory
  - `BOOKING_CONFIRMED` -> commit inventory hold

### Cross-service aligned event plan
| Service | Produces | Consumes | Purpose |
|---|---|---|---|
| `auth-service` | `auth.events` (`USER_LOGGED_IN`, `MFA_VERIFIED`, `SESSION_REVOKED`) | optional policy/risk topics | Security audit and risk triggers |
| `flight-service` | `flight.inventory.events` | `booking.events` | Seat inventory state and booking-driven inventory actions |
| `booking-service` | `booking.events` (`BOOKING_RESERVED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_CHANGED`) | `flight.inventory.events`, `payment.events` | Booking orchestration and lifecycle state |
| `payment-service` | `payment.events` (`PAYMENT_INTENT_CREATED`, `PAYMENT_AUTHORIZED`, `PAYMENT_CAPTURED`, `PAYMENT_REFUNDED`, `PAYMENT_FAILED`) | `booking.events` | Payment state machine and settlement/refund lifecycle |
| `customer-service` | `notification.events` (optional producer) | `booking.events`, `payment.events`, `flight.inventory.events` | Customer notifications and profile side-effects |
| `api-gateway` | none | none | Synchronous edge routing; not event backbone |

### Topic naming and ownership
- Business domain topics:
  - `booking.events`
  - `flight.inventory.events`
  - `payment.events`
  - `auth.events`
  - `notification.events`
- Dead-letter topics (recommended):
  - `booking.events.dlt`
  - `flight.inventory.events.dlt`
  - `payment.events.dlt`
- Ownership:
  - Topic contract versioning is owned by producer service.
  - Consumer services must be backward compatible with at least one prior schema version.

### Event contract baseline (all services)
Common required fields:
- `eventId` (globally unique id)
- `eventType`
- `occurredAt` (UTC ISO-8601)
- `source` (service name)
- `aggregateId` (e.g., `bookingId`, `flightId`, `paymentId`)
- `correlationId` (trace request chain)
- `schemaVersion` (e.g., `v1`)

Flight inventory payload extension:
- `flightId`, `holdId`, `bookingId`, `seatCount`, `actorType`, `userId`, `status`, `reason`

### Ordering, partitioning, and idempotency
- Partition key strategy:
  - `flight.inventory.events`: key by `flightId`
  - `booking.events`: key by `bookingId`
  - `payment.events`: key by `paymentId`
- This keeps in-order processing per aggregate while scaling horizontally.
- Idempotency requirements:
  - `eventId` tracked by consumers to ignore duplicates.
  - State transitions must be safe for replay (at-least-once delivery).

### Reliability strategy (aligned target)
- Producer:
  - `acks=all` (recommended in production)
  - retry with backoff
  - outbox pattern for transactional consistency (recommended for booking/payment critical events)
- Consumer:
  - manual commit only after successful processing
  - retries for transient failures
  - route poison messages to DLT
- Observability:
  - emit counters for published/consumed/failed events
  - include `correlationId` in logs and traces

### Booking/inventory canonical flow
1. `booking-service` emits `BOOKING_RESERVED` (with `holdId`).
2. `flight-service` already holds seats synchronously and emits `INVENTORY_HELD`.
3. `payment-service` emits `PAYMENT_CAPTURED`.
4. `booking-service` emits `BOOKING_CONFIRMED`.
5. `flight-service` consumes `BOOKING_CONFIRMED`, commits hold, emits `INVENTORY_COMMITTED`.
6. `customer-service` consumes final booking/payment/inventory events and notifies user.

### Cancellation/refund flow
1. `booking-service` emits `BOOKING_CANCELLED`.
2. `flight-service` consumes cancel event, releases seats, emits `INVENTORY_RELEASED`.
3. `payment-service` emits `PAYMENT_REFUNDED`.
4. `customer-service` consumes and sends cancellation/refund notification.

### Kafka runtime configuration keys
- `KAFKA_BOOTSTRAP_SERVERS` (default `localhost:9092`)
- `FLIGHT_KAFKA_INVENTORY_TOPIC` (default `flight.inventory.events`)
- `BOOKING_KAFKA_TOPIC` (default `booking.events`)
- `BOOKING_EVENTS_CONSUMER_GROUP` (default `flight-service`)
- `BOOKING_EVENTS_AUTO_OFFSET_RESET` (default `latest`)

Sample booking cancel event payload:
```json
{
  "eventId": "evt-10001",
  "eventType": "BOOKING_CANCELLED",
  "occurredAt": "2026-03-04T12:00:00Z",
  "bookingId": "BKG-001",
  "holdId": "HOLD-1001",
  "flightId": "FL-1001",
  "seatCount": 1,
  "userId": "U-CUSTOMER-1",
  "actorType": "customer"
}
```

Quick local verification:
```bash
# terminal 1: run flight-service
./mvnw quarkus:dev

# terminal 2: watch emitted inventory events
kafka-console-consumer --bootstrap-server localhost:9092 --topic flight.inventory.events --from-beginning

# terminal 3: send booking cancel event to trigger release flow
kafka-console-producer --bootstrap-server localhost:9092 --topic booking.events
>{"eventId":"evt-10001","eventType":"BOOKING_CANCELLED","occurredAt":"2026-03-04T12:00:00Z","bookingId":"BKG-001","holdId":"HOLD-1001","flightId":"FL-1001","seatCount":1,"userId":"U-CUSTOMER-1","actorType":"customer"}
```

## Notes
- Flight catalog and seat inventory are now loaded from MySQL.
- Hold records remain in-memory for this phase; seat reserve/release updates are persisted in MySQL.
