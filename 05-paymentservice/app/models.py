from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class PaymentIntentRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "bookingId": "BOOK-20260407-1001",
                "amount": 5800,
                "currency": "INR",
                "provider": "razorpay",
                "metadata": {
                    "tripId": "TRIP-9001",
                    "channel": "web",
                },
            }
        }
    )

    bookingId: str
    amount: float = Field(gt=0)
    currency: str = "INR"
    provider: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)


class PaymentActionRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "providerPaymentId": "pay_Q7x8y9z0a1b2c3",
                "providerOrderId": "order_Q7x8y9z0a1b2c3",
                "amount": 5800,
                "reason": "Customer requested capture",
                "metadata": {
                    "razorpaySignature": "generated-signature-value",
                },
            }
        }
    )

    providerPaymentId: Optional[str] = None
    providerOrderId: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)


class PaymentWebhookRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "provider": "razorpay",
                "eventType": "payment.captured",
                "payload": {
                    "paymentId": "PAY-9A8B7C6D5E4F",
                    "providerPaymentId": "pay_Q7x8y9z0a1b2c3",
                },
            }
        }
    )

    provider: str
    eventType: str
    payload: dict


class ErrorResponse(BaseModel):
    detail: str = Field(description="Human-readable error message.")


class KafkaMetricsResponse(BaseModel):
    enabled: bool = False
    publishedPaymentEvents: int = 0
    failedPaymentPublishes: int = 0
    consumedBookingEvents: int = 0
    failedBookingEvents: int = 0


class HealthDetailsResponse(BaseModel):
    mode: str
    service: str
    storage: str
    providerDefault: str
    razorpayConfigured: bool
    kafka: KafkaMetricsResponse


class HealthResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "UP",
                "details": {
                    "mode": "health",
                    "service": "payment-service",
                    "storage": "postgres",
                    "providerDefault": "razorpay",
                    "razorpayConfigured": True,
                    "kafka": {
                        "enabled": True,
                        "publishedPaymentEvents": 12,
                        "failedPaymentPublishes": 0,
                        "consumedBookingEvents": 5,
                        "failedBookingEvents": 0,
                    },
                },
            }
        }
    )

    status: str
    details: HealthDetailsResponse


class PaymentResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "paymentId": "PAY-9A8B7C6D5E4F",
                "bookingId": "BOOK-20260407-1001",
                "amount": 5800,
                "currency": "INR",
                "status": "INTENT_CREATED",
                "actorType": "customer",
                "userId": "U-101",
                "provider": "razorpay",
                "providerStatus": "ORDER_CREATED",
                "providerOrderId": "order_Q7x8y9z0a1b2c3",
                "providerPaymentId": "pay_Q7x8y9z0a1b2c3",
                "providerPublicKey": "rzp_test_123456789",
                "providerRefundId": None,
                "providerPayload": {
                    "id": "order_Q7x8y9z0a1b2c3",
                    "entity": "order",
                },
                "reason": None,
                "updatedAt": "2026-04-07T10:45:31.123456+00:00",
            }
        }
    )

    paymentId: str
    bookingId: str
    amount: float
    currency: str
    status: str
    actorType: str
    userId: str
    provider: str
    providerStatus: Optional[str] = None
    providerOrderId: Optional[str] = None
    providerPaymentId: Optional[str] = None
    providerPublicKey: Optional[str] = None
    providerRefundId: Optional[str] = None
    providerPayload: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    updatedAt: str


class ProviderWebhookAckResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "accepted": True,
                "provider": "razorpay",
                "eventType": "payment.captured",
            }
        }
    )

    accepted: bool
    provider: str
    eventType: str
