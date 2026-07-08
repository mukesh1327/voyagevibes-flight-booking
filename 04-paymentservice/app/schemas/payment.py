from typing import Optional

from pydantic import BaseModel, Field


class CreateOrderRequest(BaseModel):
    booking_id: str = Field(min_length=1)
    amount: int = Field(gt=0, description="Amount in rupees")
    currency: str = "INR"


class CreateOrderResponse(BaseModel):
    id: str
    booking_id: str
    razorpay_order_id: str
    amount: int
    currency: str
    status: str
    key_id: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class VerifyPaymentResponse(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    signature_valid: bool
    status: str


class PaymentEventResponse(BaseModel):
    razorpay_payment_id: str
    signature_valid: bool
    created_at: str


class PaymentLookupResponse(BaseModel):
    id: str
    booking_id: str
    razorpay_order_id: str
    amount: int
    currency: str
    status: str
    created_at: str
    events: list[PaymentEventResponse]
