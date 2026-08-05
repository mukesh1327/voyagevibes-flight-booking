# Payment Service

FastAPI service for Razorpay order creation and payment verification.

## Endpoints

- `GET /health`
- `POST /payments/orders`
- `POST /payments/verify`

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to use Razorpay. Without them, the service returns mock order ids and accepts `mock_signature` for local development.

Order creation is idempotent for the same booking, amount, and currency while the order is still `CREATED`, so checkout retries do not create duplicate pending orders.

## Testing with Razorpay (test mode)

Real keys are set in the repo-root `.env` (gitignored, not committed) as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. With them set, `/payments/orders` creates a real Razorpay order and the frontend opens the real hosted Razorpay Checkout instead of the mock flow.

Razorpay's own standard test-mode values (public, not secret — safe to reuse anytime):

| Field | Value |
|---|---|
| Card number | `4100 2800 0000 1007` (Visa) |
| Expiry | Any future date, e.g. `12/30` |
| CVV | Any 3 digits, e.g. `123` |
| Mobile number | Any 10-digit number, e.g. `9876543210` |
| Email | Any address (prefilled from the passenger form) |

Checkout will show a diagonal "Test Mode" ribbon when a `rzp_test_...` key is active — confirms no real money moves.

**Known gotcha:** the frontend's Content-Security-Policy must allow `checkout.razorpay.com`, `cdn.razorpay.com`, `api.razorpay.com`, and Razorpay's fraud-detection vendor `*.sardine.ai` (script-src/frame-src/connect-src/img-src) — see `voyagevibes/docker/nginx/02-customer-ui-https.conf`. Without this, the checkout script/iframe fails to load entirely and the payment button does nothing.
