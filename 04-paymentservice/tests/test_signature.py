import hmac
from hashlib import sha256

from app.main import verify_razorpay_signature


def test_mock_signature_is_valid_without_secret():
    assert verify_razorpay_signature("order_1", "pay_1", "mock_signature", "") is True


def test_invalid_signature_fails_without_secret():
    assert verify_razorpay_signature("order_1", "pay_1", "wrong", "") is False


def test_real_signature_uses_hmac_sha256():
    secret = "secret"
    expected = hmac.new(secret.encode(), b"order_1|pay_1", sha256).hexdigest()

    assert verify_razorpay_signature("order_1", "pay_1", expected, secret) is True
