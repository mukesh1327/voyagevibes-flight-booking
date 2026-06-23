import { context, isSpanContextValid, metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const enabled = import.meta.env.VITE_OTEL_ENABLED === 'true';
let initialized = false;

const parseOtlpEndpoints = (configuredEndpoint) => {
  const fallback = 'http://localhost:4318/v1/traces';
  const traceEndpoint = configuredEndpoint || fallback;
  const baseEndpoint = traceEndpoint.replace(/\/v1\/(traces|metrics|logs)$/, '');

  return {
    traces: traceEndpoint.endsWith('/v1/traces')
      ? traceEndpoint
      : `${baseEndpoint}/v1/traces`,
    metrics: traceEndpoint.endsWith('/v1/metrics')
      ? traceEndpoint
      : `${baseEndpoint}/v1/metrics`,
    logs: traceEndpoint.endsWith('/v1/logs')
      ? traceEndpoint
      : `${baseEndpoint}/v1/logs`,
    baseEndpoint,
  };
};

const safeSerialize = (value) => {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildConsoleMessage = (args) => args.map(safeSerialize).join(' ');

const installConsoleBridge = (logger) => {
  const methods = ['error', 'warn', 'info', 'log', 'debug'];
  const originals = new Map();

  for (const method of methods) {
    const original = console[method];
    if (typeof original !== 'function') {
      continue;
    }

    originals.set(method, original);
    console[method] = (...args) => {
      try {
        logger.emit({
          severityNumber:
            method === 'error'
              ? SeverityNumber.ERROR
              : method === 'warn'
                ? SeverityNumber.WARN
                : method === 'info'
                  ? SeverityNumber.INFO
                  : SeverityNumber.DEBUG,
          severityText: method.toUpperCase(),
          body: buildConsoleMessage(args),
          attributes: {
            'log.source': 'console',
            'log.console.method': method,
          },
        });
      } catch {
        // Never let telemetry collection interfere with the app itself.
      }

      original.apply(console, args);
    };
  }

  return () => {
    for (const [method, original] of originals.entries()) {
      console[method] = original;
    }
  };
};

export const initializeTelemetry = () => {
  if (!enabled || initialized) {
    return;
  }
  initialized = true;

  const serviceName = import.meta.env.VITE_OTEL_SERVICE_NAME || 'voyagevibes-ui';
  const serviceVersion = import.meta.env.VITE_OTEL_SERVICE_VERSION || '0.0.0';
  const collectorUrls = parseOtlpEndpoints(import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT);
  const propagateTraceHeaders = import.meta.env.VITE_OTEL_PROPAGATE_TRACE_HEADERS === 'true';
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    'deployment.environment': import.meta.env.MODE,
  });

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: collectorUrls.traces })),
    ],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(new OTLPLogExporter({ url: collectorUrls.logs })),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  const meterProvider = new MeterProvider({ resource });
  meterProvider.addMetricReader(
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: collectorUrls.metrics }),
      exportIntervalMillis: 30_000,
    }),
  );
  metrics.setGlobalMeterProvider(meterProvider);

  const meter = metrics.getMeter(serviceName, serviceVersion);
  const bootDuration = meter.createHistogram('voyagevibes_ui_bootstrap_duration_ms', {
    description: 'Time spent initializing browser telemetry and startup logic',
    unit: 'ms',
  });
  const appErrors = meter.createCounter('voyagevibes_ui_app_errors_total', {
    description: 'Unhandled browser and application errors',
  });

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        clearTimingResources: true,
        ignoreUrls: [
          /\/protocol\/openid-connect\/token/i,
          /\/protocol\/openid-connect\/logout/i,
        ],
        propagateTraceHeaderCorsUrls: propagateTraceHeaders ? [/.*/] : [],
      }),
    ],
  });

  const logger = loggerProvider.getLogger(serviceName, serviceVersion);
  const restoreConsole = installConsoleBridge(logger);

  window.addEventListener('error', (event) => {
    appErrors.add(1, { reason: 'window_error' });
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: buildConsoleMessage([event.message || 'Unhandled window error']),
      attributes: {
        'log.source': 'window',
        'error.type': event.error?.name || 'Error',
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    appErrors.add(1, { reason: 'unhandled_rejection' });
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: buildConsoleMessage([event.reason]),
      attributes: {
        'log.source': 'window',
        'error.type': 'unhandledrejection',
      },
    });
  });

  const startupSpan = trace.getTracer(serviceName, serviceVersion).startSpan('app bootstrap');
  const bootstrapStart = performance.now();
  startupSpan.end();

  window.addEventListener('load', () => {
    bootDuration.record(performance.now() - bootstrapStart, {
      phase: 'window_load',
    });
  }, { once: true });

  provider.forceFlush().catch((error) => {
    console.warn('Failed to flush startup telemetry', error);
  });

  window.addEventListener('beforeunload', () => {
    restoreConsole();
    provider.shutdown().catch(() => {});
    loggerProvider.shutdown().catch(() => {});
    meterProvider.shutdown().catch(() => {});
  }, { once: true });
};

export const runDemoClickTrace = (callback) => {
  const serviceName = import.meta.env.VITE_OTEL_SERVICE_NAME || 'voyagevibes-ui';
  const serviceVersion = import.meta.env.VITE_OTEL_SERVICE_VERSION || '0.0.0';
  const tracer = trace.getTracer(serviceName, serviceVersion);

  return tracer.startActiveSpan('browser click: makara demo button', async (span) => {
    try {
      const result = await callback(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
};

export const injectTraceHeaders = (headers) => {
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return;
  }

  headers.set(
    'traceparent',
    `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`,
  );
};
