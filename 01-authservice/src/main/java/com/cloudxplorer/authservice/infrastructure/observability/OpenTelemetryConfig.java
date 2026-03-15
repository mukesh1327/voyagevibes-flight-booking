package com.cloudxplorer.authservice.infrastructure.observability;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.metrics.SdkMeterProvider;
import io.opentelemetry.sdk.metrics.export.PeriodicMetricReader;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.exporter.otlp.logs.OtlpGrpcLogRecordExporter;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.exporter.otlp.metrics.OtlpGrpcMetricExporter;
import io.opentelemetry.exporter.otlp.http.metrics.OtlpHttpMetricExporter;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.logs.export.LogRecordExporter;
import io.opentelemetry.sdk.metrics.export.MetricExporter;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.time.Duration;
import java.util.Locale;

@Configuration
public class OpenTelemetryConfig {

    @Bean
    public OpenTelemetry openTelemetry(Environment environment) {
        boolean enabled = isEnabled(environment);
        if (!enabled) {
            OpenTelemetrySdk sdk = OpenTelemetrySdk.builder().build();
            GlobalOpenTelemetry.set(sdk);
            return sdk;
        }

        String serviceName = env(environment, "OTEL_SERVICE_NAME", "auth-service");
        String instanceId = env(environment, "OTEL_SERVICE_INSTANCE_ID", serviceName);
        Resource resource = Resource.getDefault().merge(Resource.create(Attributes.of(
            AttributeKey.stringKey("service.name"), serviceName,
            AttributeKey.stringKey("service.namespace"), "voyagevibes",
            AttributeKey.stringKey("service.instance.id"), instanceId
        )));

        String endpoint = env(environment, "OTEL_EXPORTER_OTLP_ENDPOINT", "http://opentelemetry-collector:4317");
        String protocol = env(environment, "OTEL_EXPORTER_OTLP_PROTOCOL", "grpc");

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
            .setResource(resource)
            .addSpanProcessor(BatchSpanProcessor.builder(buildSpanExporter(endpoint, protocol)).build())
            .build();

        SdkMeterProvider meterProvider = SdkMeterProvider.builder()
            .setResource(resource)
            .registerMetricReader(PeriodicMetricReader.builder(buildMetricExporter(endpoint, protocol))
                .setInterval(Duration.ofSeconds(15))
                .build())
            .build();

        SdkLoggerProvider loggerProvider = SdkLoggerProvider.builder()
            .setResource(resource)
            .addLogRecordProcessor(BatchLogRecordProcessor.builder(buildLogExporter(endpoint, protocol)).build())
            .build();

        OpenTelemetrySdk sdk = OpenTelemetrySdk.builder()
            .setTracerProvider(tracerProvider)
            .setMeterProvider(meterProvider)
            .setLoggerProvider(loggerProvider)
            .build();

        GlobalOpenTelemetry.set(sdk);
        return sdk;
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

    private static SpanExporter buildSpanExporter(String endpoint, String protocol) {
        if ("http".equalsIgnoreCase(protocol) || protocol.toLowerCase(Locale.ROOT).contains("http")) {
            return OtlpHttpSpanExporter.builder().setEndpoint(endpoint).build();
        }
        return OtlpGrpcSpanExporter.builder().setEndpoint(endpoint).build();
    }

    private static MetricExporter buildMetricExporter(String endpoint, String protocol) {
        if ("http".equalsIgnoreCase(protocol) || protocol.toLowerCase(Locale.ROOT).contains("http")) {
            return OtlpHttpMetricExporter.builder().setEndpoint(endpoint).build();
        }
        return OtlpGrpcMetricExporter.builder().setEndpoint(endpoint).build();
    }

    private static LogRecordExporter buildLogExporter(String endpoint, String protocol) {
        if ("http".equalsIgnoreCase(protocol) || protocol.toLowerCase(Locale.ROOT).contains("http")) {
            return OtlpHttpLogRecordExporter.builder().setEndpoint(endpoint).build();
        }
        return OtlpGrpcLogRecordExporter.builder().setEndpoint(endpoint).build();
    }
}
