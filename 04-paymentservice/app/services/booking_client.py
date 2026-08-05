import logging
import time

import httpx

from app.core.settings import settings

logger = logging.getLogger("payment_service.booking_client")

_ATTEMPTS = 2
_RETRY_DELAY_SECONDS = 0.5

_service_token_cache: dict = {"token": None, "expires_at": 0.0}


def _get_service_token() -> str:
    """Authenticates as a service account (Keycloak client-credentials grant), since
    booking-service now validates a real token on this route instead of accepting any call."""
    now = time.time()
    if _service_token_cache["token"] and now < _service_token_cache["expires_at"]:
        return _service_token_cache["token"]

    response = httpx.post(
        settings.keycloak_token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": settings.keycloak_service_client_id,
            "client_secret": settings.keycloak_service_client_secret,
        },
        timeout=5.0,
        verify=False,  # noqa: S501 - the realm's certificate is self-signed in this local/demo deployment
    )
    response.raise_for_status()
    body = response.json()
    _service_token_cache["token"] = body["access_token"]
    _service_token_cache["expires_at"] = now + max(body.get("expires_in", 60) - 15, 5)
    return _service_token_cache["token"]


def notify_booking_status(booking_id: str, status: str, payment_id: str) -> bool:
    """Best-effort: tell booking-service the payment outcome directly, instead of relying on
    the browser to PATCH the status itself. booking-service's own reconciliation sweep is the
    backstop if every attempt here fails."""
    url = f"{settings.booking_service_url}/bookings/{booking_id}/status"

    for attempt in range(1, _ATTEMPTS + 1):
        try:
            token = _get_service_token()
            response = httpx.patch(
                url,
                json={"status": status, "paymentId": payment_id},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0,
            )
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
