class NoopNotificationEventPublisher {
  publish() {
    return false;
  }
}

module.exports = { NoopNotificationEventPublisher };
