import os
from datetime import datetime, timezone
from typing import Callable, Dict, Optional
from uuid import uuid4


class PaymentService:
    def __init__(self, repository, razorpay_gateway=None):
        self.repository = repository
        self.razorpay_gateway = razorpay_gateway
        self.event_publisher: Optional[Callable[[Dict, str], None]] = None
        self.kafka_enabled = False
        self.kafka_metrics_supplier: Optional[Callable[[], Dict[str, int]]] = None
        self.kafka_metrics: Dict[str, int] = {
            "publishedPaymentEvents": 0,
            "failedPaymentPublishes": 0,
            "consumedBookingEvents": 0,
            "failedBookingEvents": 0,
        }
        self.provider_default = os.getenv("PAYMENT_PROVIDER", "mock").strip().lower() or "mock"
        self.processed_booking_event_ids = set()

    def set_event_publisher(self, event_publisher: Optional[Callable[[Dict, str], None]]):
        self.event_publisher = event_publisher

    def set_kafka_status(self, enabled: bool, metrics: Optional[Dict[str, int]] = None, metrics_supplier=None):
        self.kafka_enabled = enabled
        self.kafka_metrics_supplier = metrics_supplier
        if metrics is not None:
            self.kafka_metrics = metrics

    def create_intent(
        self,
        booking_id: str,
        amount: float,
        currency: str,
        actor_type: str,
        user_id: str,
        correlation_id: Optional[str] = None,
        provider: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ):
        payment_id = f"PAY-{uuid4().hex[:12].upper()}"
        chosen_provider = (provider or self.provider_default).strip().lower()
        provider_data = {}
        provider_status = "PENDING"

        if chosen_provider == "razorpay":
            provider_data, provider_status = self._create_razorpay_order(
                payment_id,
                booking_id,
                amount,
                currency,
                metadata or {},
            )

        payment = {
            "paymentId": payment_id,
            "bookingId": booking_id,
            "amount": amount,
            "currency": currency,
            "status": "INTENT_CREATED",
            "actorType": actor_type,
            "userId": user_id,
            "provider": chosen_provider,
            "providerStatus": provider_status,
            "providerOrderId": provider_data.get("orderId"),
            "providerPaymentId": provider_data.get("paymentId"),
            "providerPublicKey": provider_data.get("publicKey"),
            "providerRefundId": provider_data.get("refundId"),
            "providerPayload": provider_data.get("payload"),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        saved = self.repository.save(payment)
        self._emit_payment_event("PAYMENT_INTENT_CREATED", saved, correlation_id)
        return saved

    def transition(
        self,
        payment_id: str,
        status: str,
        actor_type: str,
        user_id: str,
        correlation_id: Optional[str] = None,
        provider_payment_id: Optional[str] = None,
        provider_order_id: Optional[str] = None,
        amount: Optional[float] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ):
        payment = self.repository.find(payment_id)
        if payment is None:
            raise KeyError(f"payment not found: {payment_id}")

        self._assert_authorized(payment, actor_type, user_id)

        target_status = status.strip().upper()
        current = payment["status"].strip().upper()
        if target_status == current:
            return payment

        if not self._is_transition_allowed(current, target_status):
            raise ValueError(f"invalid status transition: {current} -> {target_status}")

        update_amount = amount if amount is not None else payment["amount"]
        update_reason = reason.strip() if isinstance(reason, str) and reason.strip() else payment.get("reason")
        provider_payload = payment.get("providerPayload")

        if provider_order_id:
            payment["providerOrderId"] = provider_order_id.strip()

        if provider_payment_id:
            payment["providerPaymentId"] = provider_payment_id.strip()

        provider = (payment.get("provider") or "mock").strip().lower()
        if provider == "razorpay":
            provider_payload = self._run_razorpay_transition(
                payment,
                target_status,
                update_amount,
                metadata or {},
            )

        payment["amount"] = update_amount
        payment["status"] = target_status
        payment["reason"] = update_reason
        payment["providerPayload"] = provider_payload
        payment["updatedAt"] = datetime.now(timezone.utc).isoformat()

        saved = self.repository.save(payment)
        self._emit_payment_event(self._event_type_for_status(target_status), saved, correlation_id)
        return saved

    def apply_booking_event(self, booking_event: Dict):
        if not isinstance(booking_event, dict):
            return {"accepted": False, "reason": "payload must be object"}

        event_id = str(booking_event.get("eventId", "")).strip()
        if event_id and event_id in self.processed_booking_event_ids:
            return {"accepted": True, "deduped": True}

        event_type = str(booking_event.get("eventType", "")).strip().upper()
        if event_type not in ("BOOKING_CANCELLED", "BOOKING_CANCELED"):
            if event_id:
                self.processed_booking_event_ids.add(event_id)
            return {"accepted": True, "ignored": True}

        booking_id = str(booking_event.get("bookingId", "")).strip()
        if not booking_id:
            raise ValueError("booking cancel event requires bookingId")

        payment = self.repository.find_by_booking_id(booking_id)
        if payment is None:
            if event_id:
                self.processed_booking_event_ids.add(event_id)
            return {"accepted": True, "ignored": True, "reason": "payment not found"}

        current = str(payment.get("status", "")).upper()
        if current not in ("AUTHORIZED", "CAPTURED"):
            if event_id:
                self.processed_booking_event_ids.add(event_id)
            return {"accepted": True, "ignored": True, "reason": f"status {current} is not refundable"}

        correlation_id = booking_event.get("correlationId")
        actor_type = str(booking_event.get("actorType") or "corp").strip().lower()
        if actor_type not in ("corp", "customer"):
            actor_type = "corp"

        user_id = str(booking_event.get("userId") or payment.get("userId") or "U-DEFAULT").strip()
        self.transition(
            payment["paymentId"],
            "REFUNDED",
            actor_type="corp",
            user_id=user_id,
            correlation_id=correlation_id,
            reason="BOOKING_CANCELLED_EVENT",
            metadata={"sourceEventId": event_id, "sourceEventType": event_type},
        )

        if event_id:
            self.processed_booking_event_ids.add(event_id)
        return {"accepted": True, "paymentId": payment["paymentId"], "action": "REFUNDED"}

    def health(self, mode: str):
        kafka_metrics = self.kafka_metrics_supplier() if self.kafka_metrics_supplier else self.kafka_metrics
        storage_name = getattr(self.repository, "storage_name", "unknown")
        return {
            "status": "UP",
            "details": {
                "mode": mode,
                "service": "payment-service",
                "storage": storage_name,
                "providerDefault": self.provider_default,
                "razorpayConfigured": bool(self.razorpay_gateway and self.razorpay_gateway.enabled),
                "kafka": {
                    "enabled": self.kafka_enabled,
                    **kafka_metrics,
                },
            },
        }

    def _assert_authorized(self, payment: Dict, actor_type: str, user_id: str):
        if actor_type == "corp":
            return

        owner = str(payment.get("userId") or "").strip()
        if owner and owner.lower() != user_id.strip().lower():
            raise PermissionError("customer cannot access another user's payment")

    @staticmethod
    def _is_transition_allowed(current: str, target: str) -> bool:
        allowed = {
            "INTENT_CREATED": {"AUTHORIZED", "FAILED"},
            "AUTHORIZED": {"CAPTURED", "REFUNDED", "FAILED"},
            "CAPTURED": {"REFUNDED"},
            "REFUNDED": set(),
            "FAILED": set(),
        }
        return target in allowed.get(current, set())

    @staticmethod
    def _event_type_for_status(status: str) -> str:
        mapping = {
            "AUTHORIZED": "PAYMENT_AUTHORIZED",
            "CAPTURED": "PAYMENT_CAPTURED",
            "REFUNDED": "PAYMENT_REFUNDED",
            "FAILED": "PAYMENT_FAILED",
        }
        return mapping.get(status, "PAYMENT_UNKNOWN")

    def _emit_payment_event(self, event_type: str, payment: Dict, correlation_id: Optional[str]):
        if self.event_publisher is None:
            return

        event = {
            "eventId": uuid4().hex,
            "eventType": event_type,
            "occurredAt": datetime.now(timezone.utc).isoformat(),
            "paymentId": payment["paymentId"],
            "bookingId": payment["bookingId"],
            "amount": int(round(float(payment["amount"]))),
            "currency": payment["currency"],
            "status": payment["status"],
            "userId": payment["userId"],
            "actorType": payment["actorType"],
            "source": "payment-service",
            "schemaVersion": "v1",
            "correlationId": correlation_id,
        }
        self.event_publisher(event, payment["paymentId"])

    def _create_razorpay_order(self, payment_id: str, booking_id: str, amount: float, currency: str, metadata: Dict):
        if self.razorpay_gateway is None:
            raise RuntimeError("razorpay gateway is not initialized")

        order = self.razorpay_gateway.create_order(
            amount=amount,
            currency=currency,
            receipt=payment_id,
            notes={
                "bookingId": booking_id,
                **metadata,
            },
        )
        return (
            {
                "orderId": order.get("id"),
                "publicKey": self.razorpay_gateway.public_key_id(),
                "payload": order,
            },
            "ORDER_CREATED",
        )

    def _run_razorpay_transition(self, payment: Dict, target_status: str, amount: float, metadata: Dict):
        if self.razorpay_gateway is None:
            raise RuntimeError("razorpay gateway is not initialized")

        provider_payment_id = payment.get("providerPaymentId")
        provider_order_id = payment.get("providerOrderId")
        provider_payload = payment.get("providerPayload") or {}
        if not isinstance(provider_payload, dict):
            provider_payload = {"providerResponse": provider_payload}

        if target_status == "AUTHORIZED":
            is_valid_signature = self.razorpay_gateway.verify_payment_signature(
                provider_order_id,
                provider_payment_id,
                str(metadata.get("razorpaySignature") or "").strip(),
            )
            if not is_valid_signature:
                raise RuntimeError("invalid Razorpay payment signature")

            provider_payload["signatureVerified"] = True
            return provider_payload

        if target_status == "CAPTURED":
            response = self.razorpay_gateway.capture_payment(provider_payment_id, amount)
            return response

        if target_status == "REFUNDED":
            response = self.razorpay_gateway.refund_payment(provider_payment_id, amount, notes=metadata)
            payment["providerRefundId"] = response.get("id")
            return response

        return provider_payload
