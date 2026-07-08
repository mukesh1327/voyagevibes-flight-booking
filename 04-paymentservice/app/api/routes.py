from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.payment import (
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentLookupResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services.payment_service import create_order, get_payment_by_booking, verify_payment


router = APIRouter()


@router.get("/health")
def health():
    return {"status": "UP", "service": "payment-service"}


@router.get("/payments/health")
def payments_health():
    return {"status": "UP", "service": "payment-service"}


@router.post("/payments/orders", response_model=CreateOrderResponse, status_code=201)
def create_payment_order(request: CreateOrderRequest, db: Session = Depends(get_db)):
    return create_order(request, db)


@router.post("/payments/verify", response_model=VerifyPaymentResponse)
def verify_payment_order(request: VerifyPaymentRequest, db: Session = Depends(get_db)):
    return verify_payment(request, db)


@router.get("/payments/orders/by-booking/{booking_id}", response_model=PaymentLookupResponse)
def lookup_payment_order(
    booking_id: str,
    x_user_roles: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
):
    require_any_role(x_user_roles, {"finance-ops", "support-desk", "platform-admin", "super-admin"})
    return get_payment_by_booking(booking_id, db)


def require_any_role(header_value: str | None, allowed_roles: set[str]):
    roles = {
        role.strip().lower()
        for role in (header_value or "").split(",")
        if role.strip()
    }
    if roles.isdisjoint(allowed_roles):
        raise HTTPException(status_code=403, detail=f"{' or '.join(sorted(allowed_roles))} role is required")
