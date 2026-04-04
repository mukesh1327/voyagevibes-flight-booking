const { randomUUID } = require('crypto');

class KafkaNotificationEventPublisher {
  constructor(producer, topic, source) {
    this.producer = producer;
    this.topic = topic;
    this.source = source || 'customer-service';
  }

  async publish(notification, metadata) {
    const event = {
      eventId: randomUUID(),
      eventType: 'NOTIFICATION_ACCEPTED',
      occurredAt: new Date().toISOString(),
      source: this.source,
      schemaVersion: 'v1',
      correlationId: metadata.correlationId || null,
      userId: notification.userId,
      actorType: notification.actorType,
      notificationId: notification.notificationId,
      channel: notification.type,
      payload: notification.payload
    };

    const headers = {};
    if (metadata.correlationId) {
      headers['x-correlation-id'] = String(metadata.correlationId);
    }
    if (notification.userId) {
      headers['x-user-id'] = String(notification.userId);
    }
    if (notification.actorType) {
      headers['x-actor-type'] = String(notification.actorType);
    }

    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: notification.userId || notification.notificationId,
          value: JSON.stringify(event),
          headers
        }
      ]
    });

    return true;
  }
}

module.exports = { KafkaNotificationEventPublisher };
