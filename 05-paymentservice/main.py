import os
import asyncio
import signal
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Mapping, Optional
import uvicorn

from fastapi import Body, FastAPI, Header, HTTPException, Path
from fastapi.openapi.utils import get_openapi
from fastapi.responses import RedirectResponse

from app.actor import actor_type_from_context
from app.kafka_runtime import PaymentKafkaRuntime
from app.models import (
    ErrorResponse,
    HealthResponse,
    PaymentActionRequest,
    PaymentIntentRequest,
    PaymentResponse,
    PaymentWebhookRequest,
    ProviderWebhookAckResponse,
)
from app.observability import configure as configure_otel
from app.providers import RazorpayGateway
from app.repository import create_repository_from_env
from app.service import PaymentService
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

service = PaymentService(create_repository_from_env(), razorpay_gateway=RazorpayGateway())
kafka_runtime = PaymentKafkaRuntime(service)
runtime_lock = threading.Lock()
runtime_ref_count = 0

API_DESCRIPTION = """
HTTP API for the VoyageVibes payment service.

Use the payment endpoints to create intents and transition payments through authorization,
capture, and refund workflows. The Swagger UI also documents the operational health checks
and provider webhook endpoint exposed by this service.
""".strip()

OPENAPI_TAGS = [
    {
        "name": "Health",
        "description": "Operational probes used by infrastructure and readiness checks.",
    },
    {
        "name": "Payments",
        "description": "Payment lifecycle APIs for creating intents and processing status transitions.",
    },
    {
        "name": "Webhooks",
        "description": "Inbound provider callbacks accepted by the payment service.",
    },
]

INTENT_ERROR_RESPONSES = {
    409: {"model": ErrorResponse, "description": "Duplicate or invalid request for the current payment state."},
    502: {"model": ErrorResponse, "description": "The upstream payment provider request failed."},
}

TRANSITION_ERROR_RESPONSES = {
    403: {"model": ErrorResponse, "description": "The caller is not allowed to access this payment."},
    404: {"model": ErrorResponse, "description": "The payment id was not found."},
    409: {"model": ErrorResponse, "description": "The requested state transition is not allowed."},
    502: {"model": ErrorResponse, "description": "The upstream payment provider request failed."},
}

UserIdHeader = Annotated[
    Optional[str],
    Header(
        default="U-DEFAULT",
        alias="X-User-Id",
        description="Caller identity. Customer requests are checked against the payment owner.",
    ),
]

ActorTypeHeader = Annotated[
    Optional[str],
    Header(
        default=None,
        alias="X-Actor-Type",
        description="Actor type for authorization decisions, typically `customer` or `corp`.",
    ),
]

RealmHeader = Annotated[
    Optional[str],
    Header(
        default=None,
        alias="X-Realm",
        description="Optional realm hint used to infer actor type when it is not sent explicitly.",
    ),
]

CorrelationIdHeader = Annotated[
    Optional[str],
    Header(
        default=None,
        alias="X-Correlation-Id",
        description="Trace or workflow correlation id propagated to emitted payment events.",
    ),
]

PaymentIdPath = Annotated[
    str,
    Path(
        ...,
        description="Internal payment id returned by the payment intent API.",
        examples=["PAY-9A8B7C6D5E4F"],
    ),
]

PaymentActionBody = Annotated[
    Optional[PaymentActionRequest],
    Body(
        default=None,
        description="Optional provider-specific details used during authorization, capture, or refund transitions.",
    ),
]


def _start_runtime():
    kafka_runtime.start()
    service.set_event_publisher(kafka_runtime.publish_payment_event)
    service.set_kafka_status(
        kafka_runtime.enabled,
        kafka_runtime.metrics.snapshot(),
        metrics_supplier=kafka_runtime.metrics.snapshot,
    )


def _stop_runtime():
    kafka_runtime.stop()
    repository = getattr(service, "repository", None)
    close_fn = getattr(repository, "close", None)
    if callable(close_fn):
        close_fn()


def _acquire_runtime():
    global runtime_ref_count
    with runtime_lock:
        if runtime_ref_count == 0:
            _start_runtime()
        runtime_ref_count += 1


def _release_runtime():
    global runtime_ref_count
    with runtime_lock:
        if runtime_ref_count == 0:
            return
        runtime_ref_count -= 1
        if runtime_ref_count == 0:
            _stop_runtime()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _acquire_runtime()

    try:
        yield
    except asyncio.CancelledError:
        # Ctrl+C on Windows can cancel lifespan receive; treat as normal shutdown.
        pass
    finally:
        _release_runtime()


app = FastAPI(
    title="VoyageVibes Payment Service API",
    version="1.0.0",
    description=API_DESCRIPTION,
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "tryItOutEnabled": True,
        "docExpansion": "list",
    },
)
otel_logger_provider = configure_otel("payment-service")
if otel_logger_provider:
    FastAPIInstrumentor.instrument_app(app)


def _build_openapi_servers():
    server_config = resolve_server_config()
    public_host = str(server_config["public_host"]).strip().rstrip("/")
    if public_host.startswith("http://") or public_host.startswith("https://"):
        return [{"url": public_host, "description": "Configured public endpoint"}]

    servers = [
        {
            "url": f"http://{public_host}:{server_config['http_port']}",
            "description": "HTTP endpoint",
        }
    ]
    if bool(server_config["ssl_enabled"]):
        servers.append(
            {
                "url": f"https://{public_host}:{server_config['https_port']}",
                "description": "HTTPS endpoint",
            }
        )
    return servers


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        tags=OPENAPI_TAGS,
        routes=app.routes,
    )
    openapi_schema["info"]["contact"] = {
        "name": "VoyageVibes Platform",
    }
    openapi_schema["servers"] = _build_openapi_servers()
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


def _parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() == "true"


def _resolve_default_cert_path(cert_directory: Optional[Path], cert_base_name: str, suffix: str) -> Optional[Path]:
    if cert_directory is None or cert_base_name == "":
        return None
    return cert_directory / f"{cert_base_name}{suffix}"


def _resolve_cert_directory(cert_dir_value: Optional[str]) -> Optional[Path]:
    if cert_dir_value is None:
        return None

    raw_value = str(cert_dir_value).strip()
    if raw_value == "":
        return None

    cert_directory = Path(raw_value).expanduser()
    if not cert_directory.is_absolute():
        cert_directory = (Path(__file__).resolve().parent / cert_directory).resolve()

    if not cert_directory.exists() and cert_directory.name == "00-localhost-certs":
        compatibility_directory = cert_directory.with_name("00-localtest-certs")
        if compatibility_directory.exists():
            return compatibility_directory

    return cert_directory


def resolve_server_config(env: Optional[Mapping[str, str]] = None):
    source = os.environ if env is None else env

    try:
        parsed_http_port = int(str(source.get("HTTP_PORT", source.get("PORT", source.get("SERVER_PORT", "8085")))))
    except Exception:
        parsed_http_port = 8085
    http_port = parsed_http_port if parsed_http_port > 0 else 8085

    try:
        parsed_https_port = int(str(source.get("HTTPS_PORT", "9095")))
    except Exception:
        parsed_https_port = 9095
    https_port = parsed_https_port if parsed_https_port > 0 else 9095

    ssl_enabled = _parse_bool(source.get("SERVER_SSL_ENABLED", source.get("HTTPS_ENABLED")), False)
    listen_host = str(source.get("SERVER_HOST", source.get("LISTEN_HOST", "0.0.0.0"))).strip() or "0.0.0.0"
    public_host = str(
        source.get("PUBLIC_HOST", source.get("PUBLIC_BASE_URL", source.get("SERVICE_PUBLIC_URL", listen_host)))
    ).strip() or listen_host
    cert_base_name = str(source.get("SERVER_SSL_CERT_BASENAME", "payment.voyagevibes.in")).strip() or "payment.voyagevibes.in"

    cert_dir_value = source.get("SERVER_SSL_CERT_DIR", source.get("TLS_CERT_DIR", "../00-localhost-certs"))
    cert_directory = _resolve_cert_directory(cert_dir_value)

    cert_path_env = source.get("SERVER_SSL_CERTIFICATE")
    key_path_env = source.get("SERVER_SSL_CERTIFICATE_PRIVATE_KEY")
    cert_path = Path(cert_path_env).expanduser().resolve() if cert_path_env else _resolve_default_cert_path(
        cert_directory,
        cert_base_name,
        ".crt.pem",
    )
    key_path = Path(key_path_env).expanduser().resolve() if key_path_env else _resolve_default_cert_path(
        cert_directory,
        cert_base_name,
        ".key.pem",
    )

    return {
        "http_port": http_port,
        "https_port": https_port,
        "ssl_enabled": ssl_enabled,
        "listen_host": listen_host,
        "public_host": public_host,
        "cert_base_name": cert_base_name,
        "cert_directory": str(cert_directory) if cert_directory else None,
        "cert_path": str(cert_path) if cert_path else None,
        "key_path": str(key_path) if key_path else None,
    }


@app.get(
    "/swagger",
    include_in_schema=False,
)
def swagger_redirect():
    return RedirectResponse(url=app.docs_url or "/docs")


@app.get(
    "/api/v1/health",
    tags=["Health"],
    summary="Overall health check",
    description="Returns the service status plus storage, provider, and Kafka runtime details.",
    response_model=HealthResponse,
)
def health():
    return service.health("health")


@app.get(
    "/api/v1/health/live",
    tags=["Health"],
    summary="Liveness probe",
    description="Lightweight liveness endpoint used by container platforms.",
    response_model=HealthResponse,
)
def health_live():
    return service.health("live")


@app.get(
    "/api/v1/health/ready",
    tags=["Health"],
    summary="Readiness probe",
    description="Readiness endpoint for dependency-aware startup checks.",
    response_model=HealthResponse,
)
def health_ready():
    return service.health("ready")


@app.post(
    "/api/v1/payments/intent",
    tags=["Payments"],
    summary="Create payment intent",
    description="Creates a payment intent and, when configured, also creates an upstream provider order.",
    response_model=PaymentResponse,
    responses=INTENT_ERROR_RESPONSES,
)
def create_intent(
    payload: PaymentIntentRequest,
    x_user_id: UserIdHeader,
    x_actor_type: ActorTypeHeader,
    x_realm: RealmHeader,
    x_correlation_id: CorrelationIdHeader,
):
    actor_type = actor_type_from_context(x_actor_type, x_realm)
    try:
        return service.create_intent(
            payload.bookingId,
            payload.amount,
            payload.currency,
            actor_type,
            x_user_id or "U-DEFAULT",
            correlation_id=x_correlation_id,
            provider=payload.provider,
            metadata=payload.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post(
    "/api/v1/payments/{payment_id}/authorize",
    tags=["Payments"],
    summary="Authorize payment",
    description="Moves a payment from `INTENT_CREATED` to `AUTHORIZED` after provider authorization succeeds.",
    response_model=PaymentResponse,
    responses=TRANSITION_ERROR_RESPONSES,
)
def authorize(
    payment_id: PaymentIdPath,
    payload: PaymentActionBody,
    x_user_id: UserIdHeader,
    x_actor_type: ActorTypeHeader,
    x_realm: RealmHeader,
    x_correlation_id: CorrelationIdHeader,
):
    actor_type = actor_type_from_context(x_actor_type, x_realm)
    try:
        return service.transition(
            payment_id,
            "AUTHORIZED",
            actor_type,
            x_user_id or "U-DEFAULT",
            correlation_id=x_correlation_id,
            provider_payment_id=payload.providerPaymentId if payload else None,
            provider_order_id=payload.providerOrderId if payload else None,
            amount=payload.amount if payload else None,
            reason=payload.reason if payload else None,
            metadata=payload.metadata if payload else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post(
    "/api/v1/payments/{payment_id}/capture",
    tags=["Payments"],
    summary="Capture payment",
    description="Captures an authorized payment and stores the provider response payload.",
    response_model=PaymentResponse,
    responses=TRANSITION_ERROR_RESPONSES,
)
def capture(
    payment_id: PaymentIdPath,
    payload: PaymentActionBody,
    x_user_id: UserIdHeader,
    x_actor_type: ActorTypeHeader,
    x_realm: RealmHeader,
    x_correlation_id: CorrelationIdHeader,
):
    actor_type = actor_type_from_context(x_actor_type, x_realm)
    try:
        return service.transition(
            payment_id,
            "CAPTURED",
            actor_type,
            x_user_id or "U-DEFAULT",
            correlation_id=x_correlation_id,
            provider_payment_id=payload.providerPaymentId if payload else None,
            provider_order_id=payload.providerOrderId if payload else None,
            amount=payload.amount if payload else None,
            reason=payload.reason if payload else None,
            metadata=payload.metadata if payload else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post(
    "/api/v1/payments/{payment_id}/refund",
    tags=["Payments"],
    summary="Refund payment",
    description="Refunds an authorized or captured payment, optionally as a partial refund when `amount` is provided.",
    response_model=PaymentResponse,
    responses=TRANSITION_ERROR_RESPONSES,
)
def refund(
    payment_id: PaymentIdPath,
    payload: PaymentActionBody,
    x_user_id: UserIdHeader,
    x_actor_type: ActorTypeHeader,
    x_realm: RealmHeader,
    x_correlation_id: CorrelationIdHeader,
):
    actor_type = actor_type_from_context(x_actor_type, x_realm)
    try:
        return service.transition(
            payment_id,
            "REFUNDED",
            actor_type,
            x_user_id or "U-DEFAULT",
            correlation_id=x_correlation_id,
            provider_payment_id=payload.providerPaymentId if payload else None,
            provider_order_id=payload.providerOrderId if payload else None,
            amount=payload.amount if payload else None,
            reason=payload.reason if payload else None,
            metadata=payload.metadata if payload else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post(
    "/api/v1/payments/webhooks/provider",
    tags=["Webhooks"],
    summary="Accept provider webhook",
    description="Accepts provider webhook payloads and returns a lightweight acknowledgement.",
    response_model=ProviderWebhookAckResponse,
)
def provider_webhook(payload: PaymentWebhookRequest):
    return {
        "accepted": True,
        "provider": payload.provider,
        "eventType": payload.eventType,
    }


async def _serve(server: uvicorn.Server):
    server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
    await server.serve()


def _register_shutdown_handlers(servers, loop):
    def request_shutdown():
        for server in servers:
            server.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_shutdown)
        except NotImplementedError:
            signal.signal(sig, lambda *_args: request_shutdown())


async def run_servers(server_config):
    listen_host = str(server_config["listen_host"])
    public_host = str(server_config["public_host"])

    servers = [
        uvicorn.Server(
            uvicorn.Config(
                app,
                host=listen_host,
                port=int(server_config["http_port"]),
                log_level="info",
            )
        )
    ]

    print(f"payment-service http listening on http://{public_host}:{server_config['http_port']}")

    if bool(server_config["ssl_enabled"]):
        cert = server_config["cert_path"]
        key = server_config["key_path"]
        servers.append(
            uvicorn.Server(
                uvicorn.Config(
                    app,
                    host=listen_host,
                    port=int(server_config["https_port"]),
                    ssl_certfile=cert,
                    ssl_keyfile=key,
                    log_level="info",
                )
            )
        )
        print(f"payment-service https listening on https://{public_host}:{server_config['https_port']}")
        print(f"payment-service tls certs loaded from: {Path(cert).parent}")

    loop = asyncio.get_running_loop()
    _register_shutdown_handlers(servers, loop)

    try:
        await asyncio.gather(*[_serve(server) for server in servers])
    finally:
        for server in servers:
            server.should_exit = True


if __name__ == "__main__":
    server_config = resolve_server_config()
    ssl_enabled = bool(server_config["ssl_enabled"])
    cert = server_config["cert_path"]
    key = server_config["key_path"]

    if ssl_enabled:
        if not cert or not key:
            raise RuntimeError(
                "TLS cert/key not found. Set SERVER_SSL_CERTIFICATE and SERVER_SSL_CERTIFICATE_PRIVATE_KEY, "
                "or set SERVER_SSL_CERT_DIR (or TLS_CERT_DIR) with SERVER_SSL_CERT_BASENAME."
            )

        if not Path(cert).exists() or not Path(key).exists():
            raise RuntimeError(
                f"TLS cert files missing. cert={cert}, key={key}. "
                f"Expected {server_config['cert_base_name']}.crt.pem and {server_config['cert_base_name']}.key.pem."
            )

    asyncio.run(run_servers(server_config))

