import hmac
from hashlib import sha256
from uuid import uuid4

import razorpay

from app.core.settings import settings


def create_razorpay_order(booking_id: str, amount_paise: int, currency: str) -> str:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return f"order_mock_{booking_id}_{uuid4().hex[:8]}"

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    order = client.order.create({
        "amount": amount_paise,
        "currency": currency,
        "receipt": booking_id,
    })
    return order["id"]


def create_razorpay_refund(payment_id: str, amount_paise: int) -> str:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return f"rfnd_mock_{uuid4().hex[:12]}"

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    refund = client.payment.refund(payment_id, {"amount": amount_paise})
    return refund["id"]


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    if not secret:
        return hmac.compare_digest(signature, "mock_signature")

    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(secret.encode(), payload, sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
