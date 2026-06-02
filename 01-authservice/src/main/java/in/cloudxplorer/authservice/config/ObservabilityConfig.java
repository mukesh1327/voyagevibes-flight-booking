package in.cloudxplorer.authservice.config;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporterBuilder;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.OpenTelemetrySdkBuilder;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.SdkTracerProviderBuilder;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.api.common.AttributeKey;
import java.util.concurrent.TimeUnit;
import io.opentelemetry.context.propagation.ContextPropagators;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.baggage.propagation.W3CBaggagePropagator;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.util.StringUtils;

@Configuration
public class ObservabilityConfig {

    @Bean
    @ConditionalOnProperty(prefix = "app.observability.telemetry.logs", name = "enabled", havingValue = "true")
    public SdkLoggerProvider sdkLoggerProvider(
            AuthServiceProperties properties,
            org.springframework.core.env.Environment environment
    ) {
        AuthServiceProperties.Logs logs = properties.getObservability().getTelemetry().getLogs();
        if (!"http".equalsIgnoreCase(logs.getTransport())) {
            throw new IllegalArgumentException("Only OTLP HTTP transport is supported for logs in this service");
        }

        OtlpHttpLogRecordExporterBuilder exporter = OtlpHttpLogRecordExporter.builder()
                .setEndpoint(logs.getEndpoint())
                .setTimeout(logs.getTimeout().toMillis(), TimeUnit.MILLISECONDS);

        Resource resource = baseResource(environment);

        return SdkLoggerProvider.builder()
                .setResource(resource)
                .addLogRecordProcessor(BatchLogRecordProcessor.builder(exporter.build()).build())
                .build();
    }

    @Bean(destroyMethod = "close")
    public OpenTelemetrySdk openTelemetrySdk(
            ObjectProvider<SdkLoggerProvider> sdkLoggerProviderProvider,
            AuthServiceProperties properties,
            org.springframework.core.env.Environment environment
    ) {
        Resource resource = baseResource(environment);
        SdkTracerProviderBuilder tracerProviderBuilder = SdkTracerProvider.builder()
                .setResource(resource);

        AuthServiceProperties.Trace trace = properties.getObservability().getTelemetry().getTrace();
        if (trace.isEnabled()) {
            OtlpHttpSpanExporter spanExporter = OtlpHttpSpanExporter.builder()
                    .setEndpoint(trace.getEndpoint())
                    .setTimeout(trace.getTimeout().toMillis(), TimeUnit.MILLISECONDS)
                    .build();
            tracerProviderBuilder.addSpanProcessor(BatchSpanProcessor.builder(spanExporter).build());
        }

        OpenTelemetrySdkBuilder builder = OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProviderBuilder.build())
                .setPropagators(ContextPropagators.create(
                        io.opentelemetry.context.propagation.TextMapPropagator.composite(
                                W3CTraceContextPropagator.getInstance(),
                                W3CBaggagePropagator.getInstance()
                        )
                ));

        SdkLoggerProvider sdkLoggerProvider = sdkLoggerProviderProvider.getIfAvailable();
        if (sdkLoggerProvider != null) {
            builder.setLoggerProvider(sdkLoggerProvider);
        }

        return builder.build();
    }

    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry, org.springframework.core.env.Environment environment) {
        return openTelemetry.getTracer(serviceName(environment));
    }

    @Bean
    public ApplicationListener<ApplicationReadyEvent> openTelemetryLogbackAppenderInstaller(
            ObjectProvider<OpenTelemetry> openTelemetryProvider,
            AuthServiceProperties properties
    ) {
        return event -> {
            OpenTelemetry openTelemetry = openTelemetryProvider.getIfAvailable();
            if (openTelemetry != null && properties.getObservability().getTelemetry().getLogs().isEnabled()) {
                OpenTelemetryAppender.install(openTelemetry);
            }
        };
    }

    private String serviceName(org.springframework.core.env.Environment environment) {
        String configured = environment.getProperty("app.observability.service-name");
        if (StringUtils.hasText(configured)) {
            return configured;
        }
        return environment.getProperty("spring.application.name", "application");
    }

    private Resource baseResource(org.springframework.core.env.Environment environment) {
        String serviceNamespace = environment.getProperty("app.observability.service-namespace", "voyagevibes");
        return Resource.getDefault().merge(
                Resource.builder()
                        .put(AttributeKey.stringKey("service.name"), serviceName(environment))
                        .put(AttributeKey.stringKey("service.namespace"), serviceNamespace)
                        .build()
        );
    }
}
