from typing import Dict, Optional

from pydantic import BaseModel, Field


class PaymentIntentRequest(BaseModel):
    bookingId: str
    amount: float = Field(gt=0)
    currency: str = "INR"
    provider: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)


class PaymentActionRequest(BaseModel):
    providerPaymentId: Optional[str] = None
    providerOrderId: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)


class PaymentWebhookRequest(BaseModel):
    provider: str
    eventType: str
    payload: dict
