# Booking Service

Node.js + Express service that owns customer bookings and status transitions.

## Endpoints

- `GET /health`
- `POST /bookings`
- `GET /bookings/:id`
- `PATCH /bookings/:id/status`

JWT validation is intentionally lightweight for day-one development: the service requires an `Authorization` header and derives the user from `x-user-id` when Kong/auth middleware is later added.

When a booking is created, the service first calls Flight Service to hold seats. Only successful holds are stored as `PAYMENT_PENDING` bookings. The booking document keeps `flightNo`, `holdId`, `holdExpiresAt`, `seatsHeld`, `seatsRemaining`, passenger data, amount, status, and payment id.
