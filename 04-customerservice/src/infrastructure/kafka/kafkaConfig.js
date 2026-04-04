function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim().toLowerCase() === 'true';
}

function parseList(value, fallback) {
  const source = value === undefined || value === null || value === '' ? fallback : value;
  return String(source)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSasl(config) {
  const username = config.KAFKA_SASL_USERNAME;
  const password = config.KAFKA_SASL_PASSWORD;
  if (!username || !password) {
    return null;
  }

  return {
    mechanism: config.KAFKA_SASL_MECHANISM || 'plain',
    username,
    password
  };
}

function loadKafkaConfig(env) {
  const config = env || process.env;

  return {
    enabled: parseBoolean(config.KAFKA_ENABLED, false),
    required: parseBoolean(config.KAFKA_REQUIRED, false),
    clientId: config.KAFKA_CLIENT_ID || 'customer-service',
    brokers: parseList(config.KAFKA_BOOTSTRAP_SERVERS, 'localhost:9092'),
    consumerGroupId: config.KAFKA_CONSUMER_GROUP_ID || 'customer-service',
    autoOffsetReset: (config.KAFKA_AUTO_OFFSET_RESET || 'latest').toLowerCase() === 'earliest'
      ? 'earliest'
      : 'latest',
    ssl: parseBoolean(config.KAFKA_SSL_ENABLED, false),
    sasl: parseSasl(config),
    produceNotificationEvents: parseBoolean(config.KAFKA_PRODUCE_NOTIFICATION_EVENTS, false),
    topics: {
      booking: config.KAFKA_BOOKING_EVENTS_TOPIC || 'booking.events',
      payment: config.KAFKA_PAYMENT_EVENTS_TOPIC || 'payment.events',
      inventory: config.KAFKA_INVENTORY_EVENTS_TOPIC || 'flight.inventory.events',
      notification: config.KAFKA_NOTIFICATION_EVENTS_TOPIC || 'notification.events'
    },
    source: config.KAFKA_EVENT_SOURCE || 'customer-service'
  };
}

module.exports = { loadKafkaConfig };
