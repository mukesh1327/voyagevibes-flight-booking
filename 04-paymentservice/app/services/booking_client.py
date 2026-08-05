import logging
import time

import httpx

from app.core.settings import settings

logger = logging.getLogger("payment_service.booking_client")

_ATTEMPTS = 2
_RETRY_DELAY_SECONDS = 0.5


def notify_booking_status(booking_id: str, status: str, payment_id: str) -> bool:
    """Best-effort: tell booking-service the payment outcome directly, instead of relying on
    the browser to PATCH the status itself. booking-service's own reconciliation sweep is the
    backstop if every attempt here fails."""
    url = f"{settings.booking_service_url}/bookings/{booking_id}/status"

    for attempt in range(1, _ATTEMPTS + 1):
        try:
            response = httpx.patch(url, json={"status": status, "paymentId": payment_id}, timeout=5.0)
            if response.status_code < 300:
                return True
            logger.warning(
                "booking-service rejected status sync for booking %s -> %s (HTTP %s)",
                booking_id, status, response.status_code,
            )
        except httpx.HTTPError as error:
            logger.warning(
                "booking-service unreachable syncing booking %s -> %s (attempt %s/%s): %s",
                booking_id, status, attempt, _ATTEMPTS, error,
            )

        if attempt < _ATTEMPTS:
            time.sleep(_RETRY_DELAY_SECONDS)

    return False
