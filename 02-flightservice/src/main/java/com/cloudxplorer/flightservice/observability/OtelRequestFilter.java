package com.cloudxplorer.flightservice.observability;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

@Provider
@Priority(Priorities.USER)
public class OtelRequestFilter implements ContainerRequestFilter, ContainerResponseFilter {

  private static final String SPAN_KEY = "otel.span";
  private static final String START_KEY = "otel.start";

  @Inject
  OtelTelemetry telemetry;

  @Override
  public void filter(ContainerRequestContext requestContext) {
    if (telemetry == null || !telemetry.enabled()) {
      return;
    }
    String path = requestContext.getUriInfo().getPath();
    Span span = telemetry.tracer()
      .spanBuilder(requestContext.getMethod() + " /" + path)
      .setSpanKind(SpanKind.SERVER)
      .startSpan();
    requestContext.setProperty(SPAN_KEY, span);
    requestContext.setProperty(START_KEY, System.nanoTime());
    span.setAttribute("http.method", requestContext.getMethod());
    span.setAttribute("http.route", "/" + path);
  }

  @Override
  public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    if (telemetry == null || !telemetry.enabled()) {
      return;
    }
    Object spanObj = requestContext.getProperty(SPAN_KEY);
    Object startObj = requestContext.getProperty(START_KEY);
    if (!(spanObj instanceof Span span) || !(startObj instanceof Long start)) {
      return;
    }

    int status = responseContext.getStatus();
    double durationMs = (System.nanoTime() - start) / 1_000_000d;
    Attributes attributes = Attributes.of(
      AttributeKey.stringKey("http.method"), requestContext.getMethod(),
      AttributeKey.stringKey("http.route"), "/" + requestContext.getUriInfo().getPath(),
      AttributeKey.longKey("http.status_code"), (long) status
    );
    telemetry.requestCounter().add(1, attributes);
    telemetry.requestDurationMs().record(durationMs, attributes);

    if (telemetry.logger() != null) {
      telemetry.logger().logRecordBuilder()
        .setSeverity(status >= 500 ? Severity.ERROR : Severity.INFO)
        .setBody("http.request")
        .setAttribute(AttributeKey.stringKey("http.method"), requestContext.getMethod())
        .setAttribute(AttributeKey.stringKey("http.route"), "/" + requestContext.getUriInfo().getPath())
        .setAttribute(AttributeKey.longKey("http.status_code"), (long) status)
        .setAttribute(AttributeKey.doubleKey("http.duration_ms"), durationMs)
        .emit();
    }

    span.setAttribute("http.status_code", status);
    span.setStatus(status >= 400 ? StatusCode.ERROR : StatusCode.OK);
    span.end();
  }
}
