from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.payment import PaymentEvent, PaymentOrder
from app.schemas.payment import (
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentEventResponse,
    PaymentLookupResponse,
    RefundResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services.booking_client import notify_booking_status
from app.services.razorpay_provider import create_razorpay_order, create_razorpay_refund, verify_razorpay_signature


def create_order(request: CreateOrderRequest, db: Session) -> CreateOrderResponse:
    amount_paise = request.amount * 100
    currency = request.currency.upper()

    existing = db.query(PaymentOrder).filter(
        PaymentOrder.booking_id == request.booking_id,
        PaymentOrder.amount == amount_paise,
        PaymentOrder.currency == currency,
        PaymentOrder.status == "CREATED",
    ).first()
    if existing is not None:
        return to_order_response(existing)

    # Checkout retries should reuse pending orders before calling the provider again.
    razorpay_order_id = create_razorpay_order(request.booking_id, amount_paise, currency)

    order = PaymentOrder(
        id=str(uuid4()),
        booking_id=request.booking_id,
        razorpay_order_id=razorpay_order_id,
        amount=amount_paise,
        currency=currency,
        status="CREATED",
    )
    db.add(order)
    db.commit()

    return to_order_response(order)


def verify_payment(request: VerifyPaymentRequest, db: Session) -> VerifyPaymentResponse:
    order = db.query(PaymentOrder).filter(PaymentOrder.razorpay_order_id == request.razorpay_order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Payment order not found")
    if order.booking_id != request.booking_id:
        raise HTTPException(status_code=409, detail="Payment order does not belong to this booking")

    signature_valid = verify_razorpay_signature(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature,
        settings.razorpay_key_secret,
    )

    order.status = "PAID" if signature_valid else "FAILED"
    db.add(PaymentEvent(
        id=str(uuid4()),
        order_id=order.id,
        razorpay_payment_id=request.razorpay_payment_id,
        signature_valid=signature_valid,
        raw_payload=request.model_dump_json(),
    ))
    db.commit()

    # Confirm the booking directly instead of leaving it to the browser to PATCH the status
    # itself: a closed tab or network drop would otherwise leave a paid booking stuck pending.
    notify_booking_status(
        order.booking_id,
        "CONFIRMED" if signature_valid else "FAILED",
        request.razorpay_payment_id,
    )

    return VerifyPaymentResponse(
        booking_id=order.booking_id,
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        signature_valid=signature_valid,
        status=order.status,
    )


def refund_payment(booking_id: str, db: Session) -> RefundResponse:
    order = db.query(PaymentOrder).filter(
        PaymentOrder.booking_id == booking_id,
        PaymentOrder.status == "PAID",
    ).order_by(PaymentOrder.created_at.desc()).first()
    if order is None:
        raise HTTPException(status_code=404, detail="No paid payment order found for this booking")

    paid_event = db.query(PaymentEvent).filter(
        PaymentEvent.order_id == order.id,
        PaymentEvent.signature_valid.is_(True),
    ).order_by(PaymentEvent.created_at.desc()).first()
    if paid_event is None:
        raise HTTPException(status_code=409, detail="No verified payment found to refund")

    refund_id = create_razorpay_refund(paid_event.razorpay_payment_id, order.amount)

    order.status = "REFUNDED"
    db.add(PaymentEvent(
        id=str(uuid4()),
        order_id=order.id,
        razorpay_payment_id=refund_id,
        signature_valid=True,
        raw_payload=f'{{"type":"refund","refundedPaymentId":"{paid_event.razorpay_payment_id}"}}',
    ))
    db.commit()

    return RefundResponse(
        booking_id=order.booking_id,
        razorpay_order_id=order.razorpay_order_id,
        refund_id=refund_id,
        status=order.status,
    )


def get_payment_by_booking(booking_id: str, db: Session) -> PaymentLookupResponse:
    order = db.query(PaymentOrder).filter(PaymentOrder.booking_id == booking_id).order_by(
        PaymentOrder.created_at.desc(),
    ).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Payment order not found")

    events = db.query(PaymentEvent).filter(PaymentEvent.order_id == order.id).order_by(
        PaymentEvent.created_at.desc(),
    ).all()

    # Finance and support use this lookup to reconcile checkout state with booking status.
    return PaymentLookupResponse(
        id=order.id,
        booking_id=order.booking_id,
        razorpay_order_id=order.razorpay_order_id,
        amount=order.amount,
        currency=order.currency,
        status=order.status,
        created_at=order.created_at.isoformat(),
        events=[
            PaymentEventResponse(
                razorpay_payment_id=event.razorpay_payment_id,
                signature_valid=event.signature_valid,
                created_at=event.created_at.isoformat(),
            )
            for event in events
        ],
    )


def to_order_response(order: PaymentOrder) -> CreateOrderResponse:
    return CreateOrderResponse(
        id=order.id,
        booking_id=order.booking_id,
        razorpay_order_id=order.razorpay_order_id,
        amount=order.amount,
        currency=order.currency,
        status=order.status,
        key_id=settings.razorpay_key_id or None,
    )
