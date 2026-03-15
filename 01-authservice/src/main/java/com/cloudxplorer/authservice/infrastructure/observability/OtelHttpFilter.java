package com.cloudxplorer.authservice.infrastructure.observability;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Scope;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class OtelHttpFilter extends OncePerRequestFilter {

    private final OtelTelemetry telemetry;

    public OtelHttpFilter(OtelTelemetry telemetry) {
        this.telemetry = telemetry;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        if (!telemetry.enabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        long start = System.nanoTime();
        String route = request.getRequestURI();
        Span span = telemetry.tracer()
            .spanBuilder(request.getMethod() + " " + route)
            .setSpanKind(SpanKind.SERVER)
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            span.recordException(ex);
            span.setStatus(StatusCode.ERROR, ex.getMessage());
            throw ex;
        } finally {
            int status = response.getStatus();
            double durationMs = (System.nanoTime() - start) / 1_000_000d;
            Attributes attributes = Attributes.of(
                AttributeKey.stringKey("http.method"), request.getMethod(),
                AttributeKey.stringKey("http.route"), route,
                AttributeKey.longKey("http.status_code"), (long) status
            );
            telemetry.requestCounter().add(1, attributes);
            telemetry.requestDurationMs().record(durationMs, attributes);

            if (telemetry.logger() != null) {
                telemetry.logger().logRecordBuilder()
                    .setSeverity(status >= 500 ? Severity.ERROR : Severity.INFO)
                    .setBody("http.request")
                    .setAttribute(AttributeKey.stringKey("http.method"), request.getMethod())
                    .setAttribute(AttributeKey.stringKey("http.route"), route)
                    .setAttribute(AttributeKey.longKey("http.status_code"), (long) status)
                    .setAttribute(AttributeKey.doubleKey("http.duration_ms"), durationMs)
                    .emit();
            }

            span.setAttribute("http.status_code", status);
            span.setStatus(status >= 400 ? StatusCode.ERROR : StatusCode.OK);
            span.end();
        }
    }
}
