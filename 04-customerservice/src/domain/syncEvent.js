const { actorTypeFromContext } = require('./actorType');

const SyncStream = Object.freeze({
  BOOKING: 'booking.events',
  PAYMENT: 'payment.events',
  INVENTORY: 'flight.inventory.events'
});

const StreamEventTypes = Object.freeze({
  [SyncStream.BOOKING]: new Set([
    'BOOKING_RESERVED',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_CANCELED',
    'BOOKING_CHANGED'
  ]),
  [SyncStream.PAYMENT]: new Set([
    'PAYMENT_INTENT_CREATED',
    'PAYMENT_AUTHORIZED',
    'PAYMENT_CAPTURED',
    'PAYMENT_REFUNDED',
    'PAYMENT_FAILED'
  ]),
  [SyncStream.INVENTORY]: new Set([
    'INVENTORY_HELD',
    'INVENTORY_RELEASED',
    'INVENTORY_COMMITTED',
    'INVENTORY_EXPIRED'
  ])
});

function badRequest(message) {
  const error = new Error(message);
  error.code = 'BAD_REQUEST';
  error.statusCode = 400;
  return error;
}

function text(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function requiredText(value, fieldName) {
  const normalized = text(value);
  if (!normalized) {
    throw badRequest(`${fieldName} is required`);
  }
  return normalized;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExternalEvent(stream, payload, fallbackActorType) {
  if (!StreamEventTypes[stream]) {
    throw badRequest(`unsupported sync stream: ${stream}`);
  }

  if (!payload || typeof payload !== 'object') {
    throw badRequest('payload must be a JSON object');
  }

  const eventId = requiredText(payload.eventId, 'eventId');
  const eventType = requiredText(payload.eventType, 'eventType').toUpperCase();
  if (!StreamEventTypes[stream].has(eventType)) {
    throw badRequest(`eventType ${eventType} is not valid for ${stream}`);
  }

  const userId = requiredText(payload.userId, 'userId');
  const actorType = actorTypeFromContext(payload.actorType || fallbackActorType, payload.realm);

  return {
    stream,
    eventId,
    eventType,
    occurredAt: text(payload.occurredAt) || new Date().toISOString(),
    source: text(payload.source) || stream,
    correlationId: text(payload.correlationId),
    schemaVersion: text(payload.schemaVersion) || 'v1',
    userId,
    actorType,
    bookingId: text(payload.bookingId),
    paymentId: text(payload.paymentId),
    flightId: text(payload.flightId),
    holdId: text(payload.holdId),
    seatCount: optionalNumber(payload.seatCount),
    status: text(payload.status),
    reason: text(payload.reason),
    rawPayload: payload
  };
}

function syncFieldForStream(stream) {
  switch (stream) {
    case SyncStream.BOOKING:
      return 'booking';
    case SyncStream.PAYMENT:
      return 'payment';
    case SyncStream.INVENTORY:
      return 'inventory';
    default:
      return 'other';
  }
}

function buildPlan(event, channel, subject, message) {
  return {
    channel,
    payload: {
      userId: event.userId,
      eventId: event.eventId,
      eventType: event.eventType,
      stream: event.stream,
      occurredAt: event.occurredAt,
      bookingId: event.bookingId,
      paymentId: event.paymentId,
      flightId: event.flightId,
      holdId: event.holdId,
      subject,
      message
    }
  };
}

module.exports = {
  SyncStream,
  normalizeExternalEvent,
  syncFieldForStream
};
