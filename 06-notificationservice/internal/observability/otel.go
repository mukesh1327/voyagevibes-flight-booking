package observability

import (
	"context"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otelog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/metric"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

type Config struct {
	ServiceName string
	Endpoint    string
	Protocol    string
	Enabled     bool
}

func FromEnv(serviceName string) Config {
	enabled := strings.EqualFold(os.Getenv("OTEL_ENABLED"), "true")
	disabled := strings.EqualFold(os.Getenv("OTEL_SDK_DISABLED"), "true")
	return Config{
		ServiceName: serviceName,
		Endpoint:    env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://opentelemetry-collector:4317"),
		Protocol:    env("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc"),
		Enabled:     enabled && !disabled,
	}
}

func Setup(ctx context.Context, cfg Config) (func(context.Context) error, bool, error) {
	if !cfg.Enabled {
		return func(context.Context) error { return nil }, false, nil
	}

	endpoint, insecure := normalizeEndpoint(cfg.Endpoint)
	useHTTP := strings.Contains(strings.ToLower(cfg.Protocol), "http")

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceNamespace("voyagevibes"),
		),
	)
	if err != nil {
		return nil, false, err
	}

	traceExp, err := buildTraceExporter(ctx, endpoint, insecure, useHTTP)
	if err != nil {
		return nil, false, err
	}

	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(traceExp),
	)
	otel.SetTracerProvider(traceProvider)

	metricExp, err := buildMetricExporter(ctx, endpoint, insecure, useHTTP)
	if err != nil {
		return nil, false, err
	}
	metricReader := sdkmetric.NewPeriodicReader(metricExp, sdkmetric.WithInterval(15*time.Second))
	meterProvider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(metricReader), sdkmetric.WithResource(res))
	otel.SetMeterProvider(meterProvider)

	logExp, err := buildLogExporter(ctx, endpoint, insecure, useHTTP)
	if err != nil {
		return nil, false, err
	}
	logProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
	)
	global.SetLoggerProvider(logProvider)

	shutdown := func(ctx context.Context) error {
		_ = traceProvider.Shutdown(ctx)
		_ = meterProvider.Shutdown(ctx)
		_ = logProvider.Shutdown(ctx)
		return nil
	}
	return shutdown, true, nil
}

func buildTraceExporter(ctx context.Context, endpoint string, insecure bool, useHTTP bool) (sdktrace.SpanExporter, error) {
	if useHTTP {
		opts := []otlptracehttp.Option{otlptracehttp.WithEndpoint(endpoint)}
		if insecure {
			opts = append(opts, otlptracehttp.WithInsecure())
		}
		return otlptracehttp.New(ctx, opts...)
	}

	opts := []otlptracegrpc.Option{otlptracegrpc.WithEndpoint(endpoint)}
	if insecure {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}
	return otlptracegrpc.New(ctx, opts...)
}

func buildMetricExporter(ctx context.Context, endpoint string, insecure bool, useHTTP bool) (sdkmetric.Exporter, error) {
	if useHTTP {
		opts := []otlpmetrichttp.Option{otlpmetrichttp.WithEndpoint(endpoint)}
		if insecure {
			opts = append(opts, otlpmetrichttp.WithInsecure())
		}
		return otlpmetrichttp.New(ctx, opts...)
	}

	opts := []otlpmetricgrpc.Option{otlpmetricgrpc.WithEndpoint(endpoint)}
	if insecure {
		opts = append(opts, otlpmetricgrpc.WithInsecure())
	}
	return otlpmetricgrpc.New(ctx, opts...)
}

func buildLogExporter(ctx context.Context, endpoint string, insecure bool, useHTTP bool) (sdklog.Exporter, error) {
	if useHTTP {
		opts := []otlploghttp.Option{otlploghttp.WithEndpoint(endpoint)}
		if insecure {
			opts = append(opts, otlploghttp.WithInsecure())
		}
		return otlploghttp.New(ctx, opts...)
	}

	opts := []otlploggrpc.Option{otlploggrpc.WithEndpoint(endpoint)}
	if insecure {
		opts = append(opts, otlploggrpc.WithInsecure())
	}
	return otlploggrpc.New(ctx, opts...)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.status = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func WrapHandler(handler http.Handler, serviceName string) http.Handler {
	otelHandler := otelhttp.NewHandler(handler, serviceName)
	meter := otel.GetMeterProvider().Meter(serviceName)
	counter, _ := meter.Int64Counter("http.server.requests")
	histogram, _ := meter.Float64Histogram("http.server.duration", metric.WithUnit("ms"))
	logger := global.GetLoggerProvider().Logger(serviceName)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		otelHandler.ServeHTTP(rec, r)
		durationMs := float64(time.Since(start).Milliseconds())
		attrs := []attribute.KeyValue{
			attribute.String("http.method", r.Method),
			attribute.String("http.route", r.URL.Path),
			attribute.Int("http.status_code", rec.status),
		}
		counter.Add(r.Context(), 1, metric.WithAttributes(attrs...))
		histogram.Record(r.Context(), durationMs, metric.WithAttributes(attrs...))

		record := otelog.Record{}
		record.SetBody(otelog.StringValue("http.request"))
		if rec.status >= 500 {
			record.SetSeverity(otelog.SeverityError)
		} else {
			record.SetSeverity(otelog.SeverityInfo)
		}
		record.AddAttributes(attrs...)
		record.AddAttributes(attribute.Float64("http.duration_ms", durationMs))
		logger.Emit(r.Context(), record)
	})
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func normalizeEndpoint(raw string) (string, bool) {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return "opentelemetry-collector:4317", true
	}
	if strings.HasPrefix(clean, "http://") || strings.HasPrefix(clean, "https://") {
		parsed, err := url.Parse(clean)
		if err == nil && parsed.Host != "" {
			return parsed.Host, parsed.Scheme != "https"
		}
	}
	return clean, true
}
