# Booking Service (`8083`)

.NET 8 service for reservation lifecycle, actor-aware authorization, flight inventory orchestration, and Kafka booking events.

## Scope Implemented
- `GET /api/v1/health`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `POST /api/v1/bookings/reserve`
- `POST /api/v1/bookings/{bookingId}/confirm`
- `GET /api/v1/bookings/{bookingId}`
- `GET /api/v1/bookings`
- `POST /api/v1/bookings/{bookingId}/cancel`
- `POST /api/v1/bookings/{bookingId}/change`

## Swagger
- Swagger UI: `/swagger`
- OpenAPI JSON: `/swagger/v1/swagger.json`

## Auth/Actor Alignment
Aligned with auth/flight actor semantics:
- `X-Actor-Type`: `customer` or `corp`
- `X-Realm` fallback:
  - `PUBLIC` / `voyagevibes-public` -> `customer`
  - `CORP` / `voyagevibes-corp` -> `corp`
- `X-User-Id`: defaults to `U-DEFAULT` when missing

Policy:
- `customer`: can read/update only own bookings.
- `corp`: can access all bookings.

## Booking Orchestration Logic
- `reserve`:
  - creates booking id
  - calls `flight-service /api/v1/inventory/hold`
  - stores returned `holdId`
  - emits `BOOKING_RESERVED`
- `confirm`:
  - calls `flight-service /api/v1/inventory/commit`
  - marks booking `CONFIRMED`
  - emits `BOOKING_CONFIRMED`
- `cancel`:
  - calls `flight-service /api/v1/inventory/release`
  - marks booking `CANCELLED`
  - emits `BOOKING_CANCELLED`
- `change`:
  - releases previous hold
  - creates new hold on updated flight/seat
  - marks booking `CHANGED`
  - emits `BOOKING_CHANGED`

## Kafka Logic
- Produces: `booking.events`
  - `BOOKING_RESERVED`
  - `BOOKING_CONFIRMED`
  - `BOOKING_CANCELLED`
  - `BOOKING_CHANGED`
- Consumes:
  - `flight.inventory.events`
  - `payment.events`

Health details include Kafka counters for published/consumed/failed flows.

## Event Runtime Config
- `APP_ENV`
- `PORT`
- `SERVER_SSL_ENABLED`
- `SERVER_SSL_CERTIFICATE`
- `SERVER_SSL_CERTIFICATE_PRIVATE_KEY`
- `EXTERNALSERVICES__FLIGHT__BASEURL`
- `EXTERNALSERVICES__FLIGHT__ALLOWINSECURETLS`
- `EXTERNALSERVICES__FLIGHT__TIMEOUTSECONDS`
- `KAFKA__ENABLED`
- `KAFKA__BOOTSTRAPSERVERS`
- `KAFKA__BOOKINGEVENTSTOPIC`
- `KAFKA__INVENTORYEVENTSTOPIC`
- `KAFKA__PAYMENTEVENTSTOPIC`
- `KAFKA__CONSUMERGROUPID`
- `KAFKA__AUTOOFFSETRESET`
- `KAFKA__ENSURETOPICS`
- `KAFKA__TOPICPARTITIONS`
- `KAFKA__TOPICREPLICATIONFACTOR`
- `KAFKA__MISSINGTOPICRETRYDELAYMS`

## Environment Profiles
`APP_ENV` drives profile loading:
- `dev` -> `appsettings.dev.json`
- `prod` -> `appsettings.prod.json`

Env templates:
- `.env.dev`
- `.env.prod`

Profile intent:
- `dev`
  - booking-service runs on `http://localhost:8083`
  - flight-service base URL defaults to `https://flight.voyagevibes.in:8082`
  - `AllowInsecureTls=true` supports local self-signed certs
- `prod`
  - booking-service is expected to run as an internal HTTP service on `http://booking-service:8083`
  - flight-service base URL defaults to `http://flight-service:8082`
  - TLS termination is expected upstream at the gateway/load balancer layer

## Response Shape (Booking APIs)
Booking object now includes:
- `bookingId`
- `userId`
- `flightId`
- `seatCount`
- `status`
- `paymentStatus`
- `holdId`
- `actorType`
- `updatedAt`

## Error Model
JSON error payload:
```json
{
  "code": "BAD_REQUEST|NOT_FOUND|FORBIDDEN|CONFLICT",
  "message": "error details"
}
```
