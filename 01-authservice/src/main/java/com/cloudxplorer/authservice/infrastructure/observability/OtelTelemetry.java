package com.cloudxplorer.authservice.infrastructure.observability;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class OtelTelemetry {

    private final boolean enabled;
    private final Tracer tracer;
    private final Meter meter;
    private final Logger logger;
    private final LongCounter requestCounter;
    private final DoubleHistogram requestDurationMs;

    public OtelTelemetry(OpenTelemetry openTelemetry, Environment environment) {
        this.enabled = isEnabled(environment);
        String serviceName = env(environment, "OTEL_SERVICE_NAME", "auth-service");
        this.tracer = openTelemetry.getTracer(serviceName);
        this.meter = openTelemetry.getMeter(serviceName);
        Logger resolvedLogger = null;
        if (openTelemetry instanceof OpenTelemetrySdk sdk) {
            resolvedLogger = sdk.getSdkLoggerProvider().loggerBuilder(serviceName).build();
        }
        this.logger = resolvedLogger;
        this.requestCounter = meter.counterBuilder("http.server.requests").setUnit("1").build();
        this.requestDurationMs = meter.histogramBuilder("http.server.duration").setUnit("ms").build();
    }

    public boolean enabled() {
        return enabled;
    }

    public Tracer tracer() {
        return tracer;
    }

    public LongCounter requestCounter() {
        return requestCounter;
    }

    public DoubleHistogram requestDurationMs() {
        return requestDurationMs;
    }

    public Logger logger() {
        return logger;
    }

    private static boolean isEnabled(Environment environment) {
        String enabled = env(environment, "OTEL_ENABLED", "false");
        String disabled = env(environment, "OTEL_SDK_DISABLED", "true");
        return "true".equalsIgnoreCase(enabled) && !"true".equalsIgnoreCase(disabled);
    }

    private static String env(Environment environment, String key, String fallback) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
