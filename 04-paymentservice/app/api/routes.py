import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.payment import (
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentLookupResponse,
    RefundRequest,
    RefundResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services.payment_service import create_order, get_payment_by_booking, refund_payment, verify_payment
from app.services.token_verifier import decode_and_verify, extract_roles


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


@router.post("/payments/refunds", response_model=RefundResponse)
def refund_payment_order(request: RefundRequest, db: Session = Depends(get_db)):
    return refund_payment(request.booking_id, db)


@router.get("/payments/orders/by-booking/{booking_id}", response_model=PaymentLookupResponse)
def lookup_payment_order(
    booking_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    require_any_role(request, {"finance-ops", "support-desk", "platform-admin", "super-admin"})
    return get_payment_by_booking(booking_id, db)


def require_any_role(request: Request, allowed_roles: set[str]):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = auth_header[len("Bearer "):]
    try:
        claims = decode_and_verify(token)
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from error

    roles = extract_roles(claims)
    if roles.isdisjoint(allowed_roles):
        raise HTTPException(status_code=403, detail=f"{' or '.join(sorted(allowed_roles))} role is required")
