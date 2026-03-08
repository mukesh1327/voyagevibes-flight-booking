const { SyncStream } = require('../../domain/syncEvent');
const { KafkaNotificationEventPublisher } = require('./kafkaNotificationEventPublisher');
const { NoopNotificationEventPublisher } = require('../noopNotificationEventPublisher');

function toText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return String(value);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

class CustomerSyncKafkaRuntime {
  constructor(service, kafkaConfig, logger) {
    this.service = service;
    this.kafkaConfig = kafkaConfig;
    this.logger = logger || console;
    this.consumer = null;
    this.producer = null;
    this.started = false;
    this.streamByTopic = {};
  }

  async start() {
    if (!this.kafkaConfig.enabled) {
      this.service.setKafkaEnabled(false);
      this.service.setNotificationEventPublisher(new NoopNotificationEventPublisher());
      return;
    }

    const { Kafka } = require('kafkajs');
    const kafka = new Kafka({
      clientId: this.kafkaConfig.clientId,
      brokers: this.kafkaConfig.brokers,
      ssl: this.kafkaConfig.ssl,
      sasl: this.kafkaConfig.sasl || undefined
    });

    this.streamByTopic[this.kafkaConfig.topics.booking] = SyncStream.BOOKING;
    this.streamByTopic[this.kafkaConfig.topics.payment] = SyncStream.PAYMENT;
    this.streamByTopic[this.kafkaConfig.topics.inventory] = SyncStream.INVENTORY;

    this.consumer = kafka.consumer({ groupId: this.kafkaConfig.consumerGroupId });
    await this.consumer.connect();

    const inboundTopics = Array.from(
      new Set([
        this.kafkaConfig.topics.booking,
        this.kafkaConfig.topics.payment,
        this.kafkaConfig.topics.inventory
      ])
    );

    for (const topic of inboundTopics) {
      await this.consumer.subscribe({
        topic,
        fromBeginning: this.kafkaConfig.autoOffsetReset === 'earliest'
      });
    }

    if (this.kafkaConfig.produceNotificationEvents) {
      this.producer = kafka.producer();
      await this.producer.connect();
      this.service.setNotificationEventPublisher(
        new KafkaNotificationEventPublisher(
          this.producer,
          this.kafkaConfig.topics.notification,
          this.kafkaConfig.source
        )
      );
    } else {
      this.service.setNotificationEventPublisher(new NoopNotificationEventPublisher());
    }

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const stream = this.streamByTopic[topic];
        if (!stream) {
          return;
        }

        const payloadText = toText(message.value);
        if (!payloadText) {
          this.service.markInboundEventFailed(stream);
          this.logger.warn(`kafka message ignored: empty payload for topic ${topic}`);
          return;
        }

        const payload = tryParseJson(payloadText);
        if (!payload) {
          this.service.markInboundEventFailed(stream);
          this.logger.warn(`kafka message ignored: invalid json for topic ${topic}`);
          return;
        }

        const correlationId = toText(message.headers && (message.headers['x-correlation-id']
          || message.headers.correlationId
          || message.headers['correlation-id']));

        try {
          const fallbackActorType = toText(message.headers && message.headers['x-actor-type']) || 'customer';
          await this.service.syncExternalEvent(stream, payload, fallbackActorType, correlationId);
          this.service.markInboundEventConsumed(stream);
        } catch (error) {
          this.service.markInboundEventFailed(stream);
          this.logger.error(`failed processing ${topic} event: ${error.message}`);
        }
      }
    });

    this.service.setKafkaEnabled(true);
    this.started = true;
    this.logger.log(
      `customer-service kafka started (consume: ${inboundTopics.join(', ')}, produce: ${this.kafkaConfig.topics.notification})`
    );
  }

  async stop() {
    if (!this.started) {
      return;
    }

    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }

    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }

    this.started = false;
  }
}

module.exports = { CustomerSyncKafkaRuntime };
