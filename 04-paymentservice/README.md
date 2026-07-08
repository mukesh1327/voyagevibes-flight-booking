# Payment Service

FastAPI service for Razorpay order creation and payment verification.

## Endpoints

- `GET /health`
- `POST /payments/orders`
- `POST /payments/verify`

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to use Razorpay. Without them, the service returns mock order ids and accepts `mock_signature` for local development.

Order creation is idempotent for the same booking, amount, and currency while the order is still `CREATED`, so checkout retries do not create duplicate pending orders.
