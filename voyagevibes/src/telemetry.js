import { trace } from '@opentelemetry/api';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const enabled = import.meta.env.VITE_OTEL_ENABLED === 'true';

export const initializeTelemetry = () => {
  if (!enabled) {
    return;
  }

  const serviceName = import.meta.env.VITE_OTEL_SERVICE_NAME || 'voyagevibes-ui';
  const serviceVersion = import.meta.env.VITE_OTEL_SERVICE_VERSION || '0.0.0';
  const collectorUrl = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
  const propagateTraceHeaders = import.meta.env.VITE_OTEL_PROPAGATE_TRACE_HEADERS === 'true';

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': import.meta.env.MODE,
    }),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: collectorUrl })),
    ],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
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

  const startupSpan = trace.getTracer(serviceName, serviceVersion).startSpan('app bootstrap');
  startupSpan.end();
  provider.forceFlush().catch((error) => {
    console.warn('Failed to flush startup telemetry', error);
  });
};
