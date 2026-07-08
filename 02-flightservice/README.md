# Flight Service

.NET 8 Web API for simple flight search.

## Endpoints

- `GET /health`
- `GET /flights/search?from=DEL&to=BOM&date=2026-07-10&sort=price`
- `GET /flights/{id}`
- `POST /flights/{id}/hold`

The service owns SQL Server flight inventory data. It seeds a small development data set on startup.

`POST /flights/{id}/hold` atomically decrements `seats_available` for 1-6 seats and returns a hold id, fare, seats held, seats remaining, and expiry timestamp. This models the checkout timer used by common flight booking apps without introducing a separate inventory service yet.
