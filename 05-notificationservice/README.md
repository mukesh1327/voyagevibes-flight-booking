# Notification Service

Go + Gin service that sends or mocks booking confirmations.

## Endpoints

- `GET /health`
- `POST /notifications/booking-confirmed`

Redis stores idempotency state per booking id. The response includes status, duplicate flag, channel, recipient, and queue time so the UI can show confirmation progress while local development still mocks the email provider.
