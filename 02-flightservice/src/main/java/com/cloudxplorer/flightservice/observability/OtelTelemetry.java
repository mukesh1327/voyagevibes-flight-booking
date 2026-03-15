package com.cloudxplorer.flightservice.observability;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Tracer;
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
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import jakarta.inject.Singleton;

import java.time.Duration;
import java.util.Locale;

@Singleton
public class OtelTelemetry {

  private final boolean enabled;
  private final Tracer tracer;
  private final Logger logger;
  private final LongCounter requestCounter;
  private final DoubleHistogram requestDurationMs;

  public OtelTelemetry() {
    this.enabled = isEnabled();
    String serviceName = env("OTEL_SERVICE_NAME", "flight-service");

    OpenTelemetry openTelemetry = enabled ? buildSdk(serviceName) : OpenTelemetrySdk.builder().build();
    GlobalOpenTelemetry.set(openTelemetry);

    this.tracer = openTelemetry.getTracer(serviceName);
    Meter meter = openTelemetry.getMeter(serviceName);
    this.requestCounter = meter.counterBuilder("http.server.requests").setUnit("1").build();
    this.requestDurationMs = meter.histogramBuilder("http.server.duration").setUnit("ms").build();
    Logger resolvedLogger = null;
    if (openTelemetry instanceof OpenTelemetrySdk sdk) {
      resolvedLogger = sdk.getSdkLoggerProvider().loggerBuilder(serviceName).build();
    }
    this.logger = resolvedLogger;
  }

  public boolean enabled() {
    return enabled;
  }

  public Tracer tracer() {
    return tracer;
  }

  public Logger logger() {
    return logger;
  }

  public LongCounter requestCounter() {
    return requestCounter;
  }

  public DoubleHistogram requestDurationMs() {
    return requestDurationMs;
  }

  private OpenTelemetry buildSdk(String serviceName) {
    String endpoint = env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://opentelemetry-collector:4317");
    String protocol = env("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc");

    Resource resource = Resource.getDefault().merge(Resource.create(Attributes.of(
      AttributeKey.stringKey("service.name"), serviceName,
      AttributeKey.stringKey("service.namespace"), "voyagevibes"
    )));

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

    return OpenTelemetrySdk.builder()
      .setTracerProvider(tracerProvider)
      .setMeterProvider(meterProvider)
      .setLoggerProvider(loggerProvider)
      .build();
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

  private static boolean isEnabled() {
    String enabled = env("OTEL_ENABLED", "false");
    String disabled = env("OTEL_SDK_DISABLED", "true");
    return "true".equalsIgnoreCase(enabled) && !"true".equalsIgnoreCase(disabled);
  }

  private static String env(String key, String fallback) {
    String value = System.getenv(key);
    if (value == null || value.isBlank()) {
      return fallback;
    }
    return value.trim();
  }
}
