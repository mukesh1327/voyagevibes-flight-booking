# VoyageVibes Corp UI

Angular 21 + Tailwind CSS workspace for corp users operating on the VoyageVibes flight-booking platform.

## Scope
This app is aligned to the corp API surface documented in the root [README](../README.md):
- `POST /api/v1/auth/corp/login/init`
- `POST /api/v1/auth/corp/login/verify`
- `POST /api/v1/auth/corp/mfa/challenge`
- `POST /api/v1/auth/corp/mfa/verify`
- `GET /api/v1/flights/search`
- `POST /api/v1/pricing/quote`
- `POST /api/v1/inventory/hold`
- `POST /api/v1/bookings/reserve`
- `POST /api/v1/bookings/{bookingId}/confirm`
- `POST /api/v1/bookings/{bookingId}/cancel`
- `POST /api/v1/bookings/{bookingId}/change`
- `POST /api/v1/payments/intent`
- `POST /api/v1/payments/{paymentId}/authorize`
- `POST /api/v1/payments/{paymentId}/capture`
- `POST /api/v1/payments/{paymentId}/refund`

## UI Flow
1. Corp login with MFA bootstrap
2. Flight search and quote
3. Inventory hold
4. Booking reserve
5. Payment intent -> authorize -> capture
6. Booking confirmation
7. Change or cancel from the booking desk
8. Refund from the payment desk

## Clean Architecture Shape
```text
src/app/
  core/
    guards/       route protection
    models/       domain and API contracts
    services/     API integrations and session management
    state/        shared workbench state across feature routes
  features/
    auth/         corp login + MFA flow
    dashboard/    operational summary
    flights/      search, quote, hold
    bookings/     reserve, confirm, cancel, change
    payments/     intent, authorize, capture, refund
  layout/
    corp-shell    shared workspace frame and navigation
```

## Local Run
1. Start infra and backend services from the repo root.
2. Start the Angular app:

```bash
npm install
npm start
```

3. Open `http://localhost:4200`.

`npm start` uses `proxy.conf.json` so the UI enters the platform through Kong via:
- `/gateway-api`

The corp app now routes auth, flight, booking, and payment requests through the gateway path so local behavior matches the architecture in the root [README](../README.md).

For local development, the shared API client will retry the direct service proxy once if Kong returns an empty body, proxy error, or route/upstream failure. That keeps the app usable while gateway config is still being assembled.

## Notes
- The shell environment used for implementation did not expose `node`, `npm`, or `ng` on `PATH`, so runtime verification could not be executed here.
- The current backend demo favors corp booking and payment operations plus MFA demo flows, which is why the UI emphasizes those routes.
