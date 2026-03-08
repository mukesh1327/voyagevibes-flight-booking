class InMemoryNotificationRepository {
  constructor() {
    this.storageName = 'in-memory';
    this.notifications = [];
  }

  save(notification) {
    this.notifications.push(notification);
    return notification;
  }

  findByUserId(userId) {
    return this.notifications.filter((item) => item.userId === userId);
  }

  count() {
    return this.notifications.length;
  }
}

module.exports = { InMemoryNotificationRepository };
