import hashlib
import hmac
import os
import time
from typing import Any, Dict, Optional

from requests import exceptions as requests_exceptions


class RazorpayGateway:
    def __init__(self):
        key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()

        self.key_id = key_id
        self.key_secret = key_secret
        self.enabled = bool(self.key_id and self.key_secret)
        self._client = None
        self._import_error = None

        if not self.enabled:
            return

        try:
            import razorpay  # type: ignore

            self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
        except Exception as ex:
            self._import_error = ex
            self._client = None

    def _require_client(self):
        if not self.enabled:
            raise RuntimeError("razorpay is not configured")

        if self._client is None:
            raise RuntimeError(f"razorpay client is not available: {self._import_error}")

    @staticmethod
    def _minor_units(amount: float) -> int:
        return int(round(amount * 100))

    def public_key_id(self) -> str:
        return self.key_id

    @staticmethod
    def _is_retryable_error(error: Exception) -> bool:
        return isinstance(
            error,
            (
                requests_exceptions.ConnectionError,
                requests_exceptions.Timeout,
                requests_exceptions.ChunkedEncodingError,
            ),
        )

    def _run_with_retry(self, operation_name: str, operation):
        last_error: Optional[Exception] = None

        for attempt in range(1, 4):
            try:
                return operation()
            except Exception as error:
                last_error = error
                if not self._is_retryable_error(error) or attempt == 3:
                    break
                time.sleep(0.5 * attempt)

        raise RuntimeError(f"razorpay {operation_name} failed: {last_error}") from last_error

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not order_id:
            raise RuntimeError("providerOrderId is required for Razorpay signature verification")

        if not payment_id:
            raise RuntimeError("providerPaymentId is required for Razorpay signature verification")

        if not signature:
            raise RuntimeError("razorpaySignature is required for Razorpay signature verification")

        generated_signature = hmac.new(
            self.key_secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(generated_signature, signature)

    def create_order(
        self,
        amount: float,
        currency: str,
        receipt: str,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self._require_client()

        payload = {
            "amount": self._minor_units(amount),
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {},
        }
        return self._run_with_retry("order creation", lambda: self._client.order.create(payload))

    def capture_payment(self, provider_payment_id: str, amount: float) -> Dict[str, Any]:
        self._require_client()

        if not provider_payment_id:
            raise RuntimeError("providerPaymentId is required for Razorpay capture")

        return self._run_with_retry(
            "payment capture",
            lambda: self._client.payment.capture(provider_payment_id, self._minor_units(amount)),
        )

    def refund_payment(
        self,
        provider_payment_id: str,
        amount: float,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self._require_client()

        if not provider_payment_id:
            raise RuntimeError("providerPaymentId is required for Razorpay refund")

        payload = {
            "amount": self._minor_units(amount),
            "notes": notes or {},
        }
        return self._run_with_retry("payment refund", lambda: self._client.payment.refund(provider_payment_id, payload))
