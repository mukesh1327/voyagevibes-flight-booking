import logging
import os
from typing import Optional

from opentelemetry import trace, metrics
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GrpcSpanExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HttpSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter as GrpcMetricExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter as HttpMetricExporter
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter as GrpcLogExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter as HttpLogExporter


def _enabled() -> bool:
    enabled = os.getenv("OTEL_ENABLED", "false").lower() == "true"
    disabled = os.getenv("OTEL_SDK_DISABLED", "true").lower() == "true"
    return enabled and not disabled


def _protocol() -> str:
    return os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc").lower()


def _endpoint() -> str:
    return os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://opentelemetry-collector:4317")


def _grpc_endpoint() -> str:
    endpoint = _endpoint()
    if endpoint.startswith("http://"):
        return endpoint.replace("http://", "", 1)
    if endpoint.startswith("https://"):
        return endpoint.replace("https://", "", 1)
    return endpoint


def configure(service_name: str = "payment-service") -> Optional[LoggerProvider]:
    if not _enabled():
        return None

    resource = Resource.create({
        "service.name": service_name,
        "service.namespace": "voyagevibes",
    })

    protocol = _protocol()
    endpoint = _endpoint()
    use_http = "http" in protocol

    grpc_endpoint = _grpc_endpoint()
    span_exporter = HttpSpanExporter(endpoint=f"{endpoint}/v1/traces") if use_http else GrpcSpanExporter(endpoint=grpc_endpoint, insecure=True)
    metric_exporter = HttpMetricExporter(endpoint=f"{endpoint}/v1/metrics") if use_http else GrpcMetricExporter(endpoint=grpc_endpoint, insecure=True)
    log_exporter = HttpLogExporter(endpoint=f"{endpoint}/v1/logs") if use_http else GrpcLogExporter(endpoint=grpc_endpoint, insecure=True)

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)

    metric_reader = PeriodicExportingMetricReader(metric_exporter)
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    set_logger_provider(logger_provider)

    logging.getLogger().addHandler(LoggingHandler(level=logging.INFO, logger_provider=logger_provider))
    return logger_provider
