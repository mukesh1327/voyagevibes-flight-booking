const { context, trace, metrics, SpanKind, SpanStatusCode } = require('@opentelemetry/api');
const { logs: logsApi } = require('@opentelemetry/api-logs');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');

const enabled = String(process.env.OTEL_ENABLED || 'false').toLowerCase() === 'true'
  && String(process.env.OTEL_SDK_DISABLED || 'true').toLowerCase() !== 'true';

let tracer;
let meter;
let logger;
let requestCounter;
let requestDuration;

const init = () => {
  if (!enabled) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'customer-service';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://opentelemetry-collector:4318';
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'voyagevibes',
  });

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const metricExporter = new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` });
  const logExporter = new OTLPLogExporter({ url: `${endpoint}/v1/logs` });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
  });

  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logsApi.setGlobalLoggerProvider(loggerProvider);

  sdk.start();

  tracer = trace.getTracer(serviceName);
  meter = metrics.getMeter(serviceName);
  logger = logsApi.getLogger(serviceName);

  requestCounter = meter.createCounter('http.server.requests', {
    description: 'HTTP server request count',
  });
  requestDuration = meter.createHistogram('http.server.duration', {
    description: 'HTTP server request duration',
    unit: 'ms',
  });
};

const middleware = () => (req, res, next) => {
  if (!enabled || !tracer) {
    return next();
  }

  const start = process.hrtime.bigint();
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.route': req.path,
    },
  });

  context.with(trace.setSpan(context.active(), span), () => {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const status = res.statusCode || 0;
      span.setAttribute('http.status_code', status);
      span.setStatus(status >= 400 ? { code: SpanStatusCode.ERROR } : { code: SpanStatusCode.OK });
      span.end();

      if (requestCounter) {
        requestCounter.add(1, {
          'http.method': req.method,
          'http.route': req.path,
          'http.status_code': status,
        });
      }
      if (requestDuration) {
        requestDuration.record(durationMs, {
          'http.method': req.method,
          'http.route': req.path,
          'http.status_code': status,
        });
      }

      if (logger) {
        logger.emit({
          severityText: status >= 500 ? 'ERROR' : 'INFO',
          body: 'http.request',
          attributes: {
            'http.method': req.method,
            'http.route': req.path,
            'http.status_code': status,
            'http.duration_ms': durationMs,
          },
        });
      }
    });

    next();
  });
};

module.exports = { init, middleware };
