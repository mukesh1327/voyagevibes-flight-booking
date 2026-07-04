# Voyage Vibes - Flight booking app

## Application

VoyageVibes is a flight booking app with a React customer UI, Kong Gateway, Keycloak-backed login, and a Spring Boot auth service.

Customer users sign in with Google through Keycloak identity brokering. Corporate users sign in through the configured workforce identity flow. The auth service remains the application boundary for login bootstrap metadata, authorization-code exchange, JWT validation, logout, and customer identity operations.

## Infrastructure

| Component | Database | http Port | https Port |
|-----------|----------|-----------|------------|
| Keycloak  | Postgres | 8090      | 8091       |

**Images used**
- [Keycloak]()  
registry.redhat.io/rhbk/keycloak-rhel9:26.2-15

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

## One-Day Project Completion Plan

Keep the app simple: users log in, search flights, create a booking, pay through Razorpay, and receive a booking confirmation. Avoid building airline-grade scheduling, seat maps, refunds, coupons, loyalty, or admin-heavy workflows on day one.

### Target Microservices

Build five small services behind Kong Gateway. The Spring Boot auth service already exists and should stay the source of truth for Google login, JWT validation, and user identity.

| # | Service | Framework | Database | Port | Responsibility |
|---|---------|-----------|----------|------|----------------|
| 1 | Auth Service | Spring Boot | PostgreSQL | 8081 | Existing Google/Keycloak login, JWT validation, `/auth/me`, logout |
| 2 | Flight Service | .NET 8 Web API | SQL Server | 8083 | Search airports/flights, expose simple route/date inventory |
| 3 | Booking Service | Node.js + Express | MongoDB | 8084 | Create booking draft, store passengers, hold selected flight |
| 4 | Payment Service | FastAPI | PostgreSQL | 8085 | Create Razorpay order, verify payment signature, mark payment result |
| 5 | Notification Service | Go + Gin | Redis | 8086 | Send/mock email confirmation, keep idempotent notification status |

### Minimal User Flow

1. Customer signs in with Google.
2. Frontend calls `/api/v1/auth/me` and stores user profile in session state.
3. Customer searches flights by `from`, `to`, and `date`.
4. Customer creates a booking with one flight and passenger details.
5. Payment service creates a Razorpay order for the booking amount.
6. Frontend completes Razorpay checkout and sends payment callback data to Payment Service.
7. Booking Service marks booking as `CONFIRMED`.
8. Notification Service sends or mocks a confirmation email.

### Service Contracts

Use simple REST and JWT forwarding through Kong. Every protected service should read the user id from the validated bearer token or accept trusted identity headers only from the gateway.

| Endpoint | Method | Owner | Purpose |
|----------|--------|-------|---------|
| `/api/v1/auth/frontend-config` | GET | Auth | Frontend login bootstrap |
| `/api/v1/auth/me` | GET | Auth | Current user details |
| `/api/v1/flights/search?from=&to=&date=` | GET | Flight | Return available flights |
| `/api/v1/bookings` | POST | Booking | Create booking draft |
| `/api/v1/bookings/{id}` | GET | Booking | Read booking status |
| `/api/v1/payments/orders` | POST | Payment | Create Razorpay order for booking |
| `/api/v1/payments/verify` | POST | Payment | Verify Razorpay payment signature |
| `/api/v1/notifications/booking-confirmed` | POST | Notification | Send confirmation email or mock event |

### Data Model

Keep each database owned by one service. Do not share tables between services.

**Flight Service - SQL Server**
- `airports(id, code, city, name)`
- `flights(id, flight_no, origin, destination, departure_time, arrival_time, price, seats_available)`

**Booking Service - MongoDB**
- `bookings`: `{ id, userId, flightId, passengers, amount, status, paymentId, createdAt }`
- Status values: `DRAFT`, `PAYMENT_PENDING`, `CONFIRMED`, `FAILED`

**Payment Service - PostgreSQL**
- `payment_orders(id, booking_id, razorpay_order_id, amount, currency, status, created_at)`
- `payment_events(id, order_id, razorpay_payment_id, signature_valid, raw_payload, created_at)`

**Notification Service - Redis**
- Key: `notification:booking:{bookingId}`
- Value: `PENDING`, `SENT`, or `FAILED`

### Clean Code Rules

- Keep controllers thin; put business rules in services/use cases.
- Use DTOs/request models at API boundaries; do not expose database models directly.
- Validate all inputs close to the API boundary.
- Add one health endpoint per service.
- Add one happy-path integration test or API test per service.
- Use clear status transitions instead of boolean flags.
- Keep functions small and deterministic where possible.
- Use DSA intentionally:
  - Flight search: filter by route/date, sort by price or departure time.
  - Booking: use a map/set for idempotency checks.
  - Payment verification: constant-time signature comparison where supported.
  - Notification: use Redis key TTL/idempotency to avoid duplicate sends.

### One-Day Sprint

| Time | Sprint | Outcome |
|------|--------|---------|
| 09:00-09:30 | Scope lock | Confirm only search, booking, payment, confirmation are in scope |
| 09:30-10:30 | Gateway + contracts | Add Kong routes and OpenAPI/README contracts for all services |
| 10:30-12:00 | Flight Service | .NET API with seeded airports/flights and search endpoint |
| 12:00-13:30 | Booking Service | Node API with MongoDB booking draft and status endpoints |
| 13:30-14:00 | Buffer | Run compose, fix wiring issues |
| 14:00-15:30 | Payment Service | FastAPI Razorpay order creation and signature verification |
| 15:30-16:15 | Notification Service | Go API with Redis-backed idempotent confirmation |
| 16:15-17:30 | Frontend integration | Connect search, booking, payment, confirmation screens |
| 17:30-18:30 | Testing | Run unit/API tests, verify one full user journey |
| 18:30-19:00 | Cleanup | Update README, env examples, compose commands, known gaps |

### Build Prompts

Use these prompts one at a time to finish quickly.

**Prompt 1 - Gateway and contracts**
```text
Add Kong routes and README contracts for flight-service, booking-service, payment-service, and notification-service. Keep auth-service unchanged. Use /api/v1/flights, /api/v1/bookings, /api/v1/payments, and /api/v1/notifications. Update compose placeholders only; do not build service internals yet.
```

**Prompt 2 - Flight Service**
```text
Create a .NET 8 Web API flight-service with SQL Server. Add migrations or schema init for airports and flights, seed 8 flights, and implement GET /flights/search?from=&to=&date=. Keep code layered into controllers, services, repositories, and DTOs. Add tests for route filtering and sorting.
```

**Prompt 3 - Booking Service**
```text
Create a Node.js Express booking-service with MongoDB. Implement POST /bookings and GET /bookings/:id. Validate JWT presence, passenger input, and flightId. Use booking statuses DRAFT, PAYMENT_PENDING, CONFIRMED, FAILED. Keep controllers thin and move business rules to services.
```

**Prompt 4 - Payment Service**
```text
Create a FastAPI payment-service with PostgreSQL and Razorpay integration. Implement POST /payments/orders and POST /payments/verify. Store payment orders/events, verify Razorpay HMAC signatures, and return a clean payment status. Use Pydantic models, SQLAlchemy repositories, and focused tests.
```

**Prompt 5 - Notification Service**
```text
Create a Go Gin notification-service with Redis. Implement POST /notifications/booking-confirmed. Make sending idempotent by bookingId and store SENT/FAILED status in Redis. Mock email sending for local development and add a health endpoint.
```

**Prompt 6 - Frontend**
```text
Update the React frontend after login to support a simple flight booking flow: search flights, select one flight, enter passenger details, create booking, launch Razorpay checkout, verify payment, and show confirmation. Keep UI minimal and developer-friendly.
```

**Prompt 7 - Final hardening**
```text
Run lint, builds, and tests for all services. Fix failing tests, remove dead code, update .env.example files, document compose startup steps, and list only real known gaps.
```

### Done Criteria

- Google login works through the existing auth service.
- A user can complete one booking from search to confirmation locally.
- All five services have health endpoints and basic tests.
- Kong routes every service under `/api/v1`.
- Each service owns its own database/storage.
- README and env examples are enough for a new developer to run the app.
