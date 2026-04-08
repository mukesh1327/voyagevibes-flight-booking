function inferBaseUrl(req) {
  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host') || 'localhost:8084';
  return `${protocol}://${host}`;
}

function buildOpenApiSpec(req) {
  const baseUrl = inferBaseUrl(req);

  const sharedErrorResponse = {
    description: 'Unexpected or validation error.',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        }
      }
    }
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'VoyageVibes Customer Service API',
      version: '1.0.0',
      description: [
        'OpenAPI documentation for the HTTP endpoints currently served by customer-service.',
        'Legacy notification endpoints from older Postman collections are not mounted in this app and are intentionally excluded.'
      ].join(' ')
    },
    servers: [
      {
        url: baseUrl,
        description: 'Current request origin'
      }
    ],
    tags: [
      { name: 'Health', description: 'Service health and readiness probes.' },
      { name: 'Profile', description: 'Customer profile lookup and update APIs.' },
      { name: 'Verification', description: 'Mobile verification flows for the current user.' },
      { name: 'Sync', description: 'Inbound sync events consumed from upstream domains.' }
    ],
    components: {
      parameters: {
        UserIdHeader: {
          name: 'X-User-Id',
          in: 'header',
          required: false,
          description: 'User identifier. Defaults to U-CUSTOMER-1 when omitted.',
          schema: { type: 'string', example: 'U-CUSTOMER-1' }
        },
        ActorTypeHeader: {
          name: 'X-Actor-Type',
          in: 'header',
          required: false,
          description: 'Actor type used to resolve customer vs corp behavior.',
          schema: { type: 'string', enum: ['customer', 'corp'], example: 'customer' }
        },
        RealmHeader: {
          name: 'X-Realm',
          in: 'header',
          required: false,
          description: 'Alternate realm hint. corp or voyagevibes-corp resolves actor type to corp.',
          schema: { type: 'string', example: 'voyagevibes-corp' }
        },
        CorrelationIdHeader: {
          name: 'X-Correlation-Id',
          in: 'header',
          required: false,
          description: 'Optional correlation id for tracing inbound sync requests.',
          schema: { type: 'string', example: 'corr-01HZZZZZZZZZZZZZZZZZZZZZZ' }
        }
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          required: ['status', 'details'],
          properties: {
            status: { type: 'string', example: 'UP' },
            details: {
              type: 'object',
              required: ['mode', 'service', 'storage', 'sync', 'kafka'],
              properties: {
                mode: { type: 'string', enum: ['health', 'live', 'ready'], example: 'health' },
                service: { type: 'string', example: 'customer-service' },
                storage: { type: 'string', example: 'mongodb' },
                sync: {
                  type: 'object',
                  properties: {
                    processedEvents: { type: 'integer', example: 42 }
                  }
                },
                kafka: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean', example: true },
                    consumed: { $ref: '#/components/schemas/KafkaMetricBucket' },
                    failedConsumed: { $ref: '#/components/schemas/KafkaMetricBucket' },
                    publishedNotificationEvents: { type: 'integer', example: 0 },
                    failedNotificationPublishes: { type: 'integer', example: 0 }
                  }
                }
              }
            }
          }
        },
        KafkaMetricBucket: {
          type: 'object',
          properties: {
            booking: { type: 'integer', example: 10 },
            payment: { type: 'integer', example: 5 },
            inventory: { type: 'integer', example: 3 },
            other: { type: 'integer', example: 0 }
          }
        },
        ServiceProfile: {
          type: 'object',
          required: ['userId', 'actorType', 'name', 'firstName', 'lastName', 'email', 'mobile', 'mobileVerified', 'preferences'],
          properties: {
            userId: { type: 'string', example: 'U-CUSTOMER-1' },
            actorType: { type: 'string', enum: ['customer', 'corp'], example: 'customer' },
            name: { type: 'string', example: 'Ava Admin' },
            firstName: { type: 'string', example: 'Ava' },
            lastName: { type: 'string', example: 'Admin' },
            email: { type: 'string', format: 'email', example: 'ava.admin@voyagevibes.dev' },
            mobile: { type: 'string', example: '+919999999999' },
            mobileVerified: { type: 'boolean', example: false },
            preferences: { type: 'object', additionalProperties: true, example: { seat: 'window', meal: 'veg' } },
            syncVersion: { type: 'integer', nullable: true, example: 4 },
            syncState: { $ref: '#/components/schemas/SyncState' }
          }
        },
        ServiceProfileUpdate: {
          type: 'object',
          description: 'Fields supplied here are merged onto the existing profile.',
          additionalProperties: true,
          properties: {
            name: { type: 'string', example: 'Ava Admin' },
            firstName: { type: 'string', example: 'Ava' },
            lastName: { type: 'string', example: 'Admin' },
            email: { type: 'string', format: 'email', example: 'ava.admin@voyagevibes.dev' },
            mobile: { type: 'string', example: '+919999999999' },
            mobileVerified: { type: 'boolean', example: true },
            preferences: { type: 'object', additionalProperties: true, example: { seat: 'window' } }
          }
        },
        SyncState: {
          type: 'object',
          nullable: true,
          properties: {
            booking: { $ref: '#/components/schemas/SyncStateEntry' },
            payment: { $ref: '#/components/schemas/SyncStateEntry' },
            inventory: { $ref: '#/components/schemas/SyncStateEntry' }
          }
        },
        SyncStateEntry: {
          type: 'object',
          properties: {
            eventId: { type: 'string', example: 'evt-booking-001' },
            eventType: { type: 'string', example: 'BOOKING_CONFIRMED' },
            stream: { type: 'string', example: 'booking.events' },
            occurredAt: { type: 'string', format: 'date-time', example: '2026-03-15T18:30:00.000Z' },
            source: { type: 'string', example: 'booking.events' },
            bookingId: { type: 'string', nullable: true, example: 'BOOK-1001' },
            paymentId: { type: 'string', nullable: true, example: 'PAY-1001' },
            flightId: { type: 'string', nullable: true, example: 'FL-204' },
            holdId: { type: 'string', nullable: true, example: 'HOLD-204' },
            seatCount: { type: 'number', nullable: true, example: 2 },
            status: { type: 'string', nullable: true, example: 'CONFIRMED' },
            reason: { type: 'string', nullable: true, example: 'inventory synchronized' }
          }
        },
        MobileVerifyRequestResponse: {
          type: 'object',
          properties: {
            challengeId: { type: 'string', example: 'MV-1741600000000' },
            userId: { type: 'string', example: 'U-CUSTOMER-1' },
            channel: { type: 'string', example: 'sms' }
          }
        },
        MobileVerifyConfirmResponse: {
          type: 'object',
          properties: {
            verified: { type: 'boolean', example: true },
            userId: { type: 'string', example: 'U-CUSTOMER-1' }
          }
        },
        BookingSyncEventRequest: {
          type: 'object',
          required: ['eventId', 'eventType', 'userId'],
          properties: {
            eventId: { type: 'string', example: 'evt-booking-001' },
            eventType: { type: 'string', enum: ['BOOKING_RESERVED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_CANCELED', 'BOOKING_CHANGED'], example: 'BOOKING_CONFIRMED' },
            userId: { type: 'string', example: 'U-CUSTOMER-1' },
            actorType: { type: 'string', enum: ['customer', 'corp'], example: 'customer' },
            realm: { type: 'string', example: 'voyagevibes-corp' },
            occurredAt: { type: 'string', format: 'date-time', example: '2026-03-15T18:30:00.000Z' },
            source: { type: 'string', example: 'booking-service' },
            correlationId: { type: 'string', example: 'corr-booking-001' },
            schemaVersion: { type: 'string', example: 'v1' },
            bookingId: { type: 'string', example: 'BOOK-1001' },
            status: { type: 'string', example: 'CONFIRMED' },
            reason: { type: 'string', example: 'booking completed' }
          }
        },
        PaymentSyncEventRequest: {
          type: 'object',
          required: ['eventId', 'eventType', 'userId'],
          properties: {
            eventId: { type: 'string', example: 'evt-payment-001' },
            eventType: { type: 'string', enum: ['PAYMENT_INTENT_CREATED', 'PAYMENT_AUTHORIZED', 'PAYMENT_CAPTURED', 'PAYMENT_REFUNDED', 'PAYMENT_FAILED'], example: 'PAYMENT_CAPTURED' },
            userId: { type: 'string', example: 'U-CUSTOMER-1' },
            actorType: { type: 'string', enum: ['customer', 'corp'], example: 'customer' },
            realm: { type: 'string', example: 'voyagevibes-corp' },
            occurredAt: { type: 'string', format: 'date-time', example: '2026-03-15T18:30:00.000Z' },
            source: { type: 'string', example: 'payment-service' },
            correlationId: { type: 'string', example: 'corr-payment-001' },
            schemaVersion: { type: 'string', example: 'v1' },
            paymentId: { type: 'string', example: 'PAY-1001' },
            status: { type: 'string', example: 'CAPTURED' },
            reason: { type: 'string', example: 'payment settled' }
          }
        },
        InventorySyncEventRequest: {
          type: 'object',
          required: ['eventId', 'eventType', 'userId'],
          properties: {
            eventId: { type: 'string', example: 'evt-inventory-001' },
            eventType: { type: 'string', enum: ['INVENTORY_HELD', 'INVENTORY_RELEASED', 'INVENTORY_COMMITTED', 'INVENTORY_EXPIRED'], example: 'INVENTORY_COMMITTED' },
            userId: { type: 'string', example: 'U-CUSTOMER-1' },
            actorType: { type: 'string', enum: ['customer', 'corp'], example: 'customer' },
            realm: { type: 'string', example: 'voyagevibes-corp' },
            occurredAt: { type: 'string', format: 'date-time', example: '2026-03-15T18:30:00.000Z' },
            source: { type: 'string', example: 'inventory-service' },
            correlationId: { type: 'string', example: 'corr-inventory-001' },
            schemaVersion: { type: 'string', example: 'v1' },
            flightId: { type: 'string', example: 'FL-204' },
            holdId: { type: 'string', example: 'HOLD-204' },
            seatCount: { type: 'number', example: 2 },
            status: { type: 'string', example: 'COMMITTED' },
            reason: { type: 'string', example: 'seats assigned' }
          }
        },
        SyncAcceptedResponse: {
          type: 'object',
          required: ['accepted', 'duplicate', 'stream', 'eventId', 'eventType'],
          properties: {
            accepted: { type: 'boolean', example: true },
            duplicate: { type: 'boolean', example: false },
            stream: { type: 'string', example: 'booking.events' },
            eventId: { type: 'string', example: 'evt-booking-001' },
            eventType: { type: 'string', example: 'BOOKING_CONFIRMED' },
            userId: { type: 'string', nullable: true, example: 'U-CUSTOMER-1' },
            actorType: { type: 'string', nullable: true, enum: ['customer', 'corp'], example: 'customer' },
            syncedAt: { type: 'string', nullable: true, format: 'date-time', example: '2026-03-15T18:30:05.000Z' },
            profileSyncVersion: { type: 'integer', nullable: true, example: 3 }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'BAD_REQUEST' },
            message: { type: 'string', example: 'eventId is required' }
          }
        }
      }
    },
    paths: {
      '/api/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Get service health',
          responses: { 200: { description: 'Overall health response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } }
        }
      },
      '/api/v1/health/live': {
        get: {
          tags: ['Health'],
          summary: 'Get liveness status',
          responses: { 200: { description: 'Liveness probe response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } }
        }
      },
      '/api/v1/health/ready': {
        get: {
          tags: ['Health'],
          summary: 'Get readiness status',
          responses: { 200: { description: 'Readiness probe response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } }
        }
      },
      '/api/v1/users/me': {
        get: {
          tags: ['Profile'],
          summary: 'Get the current user profile',
          parameters: [
            { $ref: '#/components/parameters/UserIdHeader' },
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' }
          ],
          responses: {
            200: { description: 'Current profile.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceProfile' } } } },
            500: sharedErrorResponse
          }
        },
        patch: {
          tags: ['Profile'],
          summary: 'Update the current user profile',
          parameters: [
            { $ref: '#/components/parameters/UserIdHeader' },
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceProfileUpdate' } } }
          },
          responses: {
            200: { description: 'Updated profile.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceProfile' } } } },
            500: sharedErrorResponse
          }
        }
      },
      '/api/v1/users/me/mobile/verify/request': {
        post: {
          tags: ['Verification'],
          summary: 'Request mobile verification',
          parameters: [
            { $ref: '#/components/parameters/UserIdHeader' },
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' }
          ],
          responses: {
            200: { description: 'Verification challenge created.', content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileVerifyRequestResponse' } } } },
            500: sharedErrorResponse
          }
        }
      },
      '/api/v1/users/me/mobile/verify/confirm': {
        post: {
          tags: ['Verification'],
          summary: 'Confirm mobile verification',
          parameters: [
            { $ref: '#/components/parameters/UserIdHeader' },
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' }
          ],
          responses: {
            200: { description: 'Mobile marked as verified.', content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileVerifyConfirmResponse' } } } },
            500: sharedErrorResponse
          }
        }
      },
      '/api/v1/sync/booking-events': {
        post: {
          tags: ['Sync'],
          summary: 'Accept booking domain events',
          parameters: [
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' },
            { $ref: '#/components/parameters/CorrelationIdHeader' }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingSyncEventRequest' } } }
          },
          responses: {
            200: { description: 'Event accepted or identified as duplicate.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncAcceptedResponse' } } } },
            400: sharedErrorResponse,
            500: sharedErrorResponse
          }
        }
      },
      '/api/v1/sync/payment-events': {
        post: {
          tags: ['Sync'],
          summary: 'Accept payment domain events',
          parameters: [
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' },
            { $ref: '#/components/parameters/CorrelationIdHeader' }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentSyncEventRequest' } } }
          },
          responses: {
            200: { description: 'Event accepted or identified as duplicate.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncAcceptedResponse' } } } },
            400: sharedErrorResponse,
            500: sharedErrorResponse
          }
        }
      },
      '/api/v1/sync/inventory-events': {
        post: {
          tags: ['Sync'],
          summary: 'Accept inventory domain events',
          parameters: [
            { $ref: '#/components/parameters/ActorTypeHeader' },
            { $ref: '#/components/parameters/RealmHeader' },
            { $ref: '#/components/parameters/CorrelationIdHeader' }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/InventorySyncEventRequest' } } }
          },
          responses: {
            200: { description: 'Event accepted or identified as duplicate.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncAcceptedResponse' } } } },
            400: sharedErrorResponse,
            500: sharedErrorResponse
          }
        }
      }
    }
  };
}

function escapeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function renderSwaggerHtml(spec) {
  const serializedSpec = escapeForInlineScript(spec);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VoyageVibes Customer Service API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #f4f7fb;
        color: #172033;
      }
      .topbar {
        padding: 20px 24px;
        background: linear-gradient(135deg, #0f4c81, #1677b3);
        color: #fff;
      }
      .topbar h1 {
        margin: 0 0 6px;
        font-size: 28px;
      }
      .topbar p {
        margin: 0;
        max-width: 920px;
        opacity: 0.92;
      }
      #swagger-ui,
      #fallback {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      #fallback[hidden] {
        display: none;
      }
      .fallback-note {
        padding: 12px 16px;
        border-radius: 10px;
        background: #fff4d6;
        border: 1px solid #f0d58a;
        margin-bottom: 20px;
      }
      .endpoint {
        background: #ffffff;
        border: 1px solid #d8e2ee;
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 16px;
        box-shadow: 0 8px 30px rgba(24, 45, 82, 0.06);
      }
      .method {
        display: inline-block;
        min-width: 62px;
        padding: 5px 10px;
        margin-right: 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-align: center;
        color: #fff;
      }
      .method.get { background: #12805c; }
      .method.post { background: #0f67b0; }
      .method.patch { background: #b96900; }
      .path {
        font-family: Consolas, "Courier New", monospace;
        font-size: 16px;
        font-weight: 600;
      }
      .summary {
        margin: 10px 0 0;
      }
      .meta {
        margin-top: 12px;
        font-size: 14px;
        color: #41506a;
      }
      .meta strong {
        color: #172033;
      }
    </style>
  </head>
  <body>
    <div class="topbar">
      <h1>Customer Service API Docs</h1>
      <p>Swagger-style documentation for the APIs currently served by this service. The raw OpenAPI document is available at <code>/api-docs.json</code>.</p>
    </div>
    <div id="swagger-ui"></div>
    <div id="fallback" hidden></div>
    <script>
      window.__CUSTOMER_SERVICE_OPENAPI__ = ${serializedSpec};

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function renderFallback(spec) {
        var swaggerRoot = document.getElementById('swagger-ui');
        var fallbackRoot = document.getElementById('fallback');
        swaggerRoot.innerHTML = '';
        fallbackRoot.hidden = false;

        var blocks = [
          '<div class="fallback-note">Swagger UI assets could not be loaded from the CDN, so this page is showing a built-in API list instead.</div>'
        ];

        Object.keys(spec.paths).forEach(function(pathKey) {
          var operations = spec.paths[pathKey];
          Object.keys(operations).forEach(function(method) {
            var operation = operations[method];
            var headerNames = (operation.parameters || [])
              .map(function(parameter) {
                if (parameter.$ref) {
                  var refKey = parameter.$ref.split('/').slice(-1)[0];
                  var resolvedParameter = spec.components && spec.components.parameters
                    ? spec.components.parameters[refKey]
                    : null;
                  return resolvedParameter && resolvedParameter.name ? resolvedParameter.name : refKey;
                }
                return parameter.name;
              })
              .join(', ');

            blocks.push(
              '<section class="endpoint">' +
                '<div><span class="method ' + escapeHtml(method) + '">' + escapeHtml(method.toUpperCase()) + '</span>' +
                '<span class="path">' + escapeHtml(pathKey) + '</span></div>' +
                '<p class="summary">' + escapeHtml(operation.summary || '') + '</p>' +
                '<div class="meta"><strong>Tag:</strong> ' + escapeHtml((operation.tags || []).join(', ') || 'General') + '</div>' +
                '<div class="meta"><strong>Headers:</strong> ' + escapeHtml(headerNames || 'None') + '</div>' +
              '</section>'
            );
          });
        });

        fallbackRoot.innerHTML = blocks.join('');
      }

      function bootSwaggerUi() {
        if (!window.SwaggerUIBundle) {
          renderFallback(window.__CUSTOMER_SERVICE_OPENAPI__);
          return;
        }

        window.SwaggerUIBundle({
          spec: window.__CUSTOMER_SERVICE_OPENAPI__,
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          defaultModelsExpandDepth: 2,
          docExpansion: 'list'
        });
      }
    </script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" onload="bootSwaggerUi()" onerror="renderFallback(window.__CUSTOMER_SERVICE_OPENAPI__)"></script>
  </body>
</html>`;
}

module.exports = {
  buildOpenApiSpec,
  renderSwaggerHtml
};

