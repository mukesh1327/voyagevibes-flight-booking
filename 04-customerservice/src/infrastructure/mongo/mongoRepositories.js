function stripInternalId(document) {
  if (!document) {
    return null;
  }

  const { _id, ...rest } = document;
  return rest;
}

class MongoUserRepository {
  constructor(collection) {
    this.collection = collection;
    this.storageName = 'mongodb';
  }

  async init() {
    await this.collection.createIndex({ userId: 1 }, { unique: true, name: 'ux_users_userId' });
    await this.collection.createIndex({ actorType: 1 }, { name: 'ix_users_actorType' });
  }

  async findById(userId) {
    const document = await this.collection.findOne({ userId });
    return stripInternalId(document);
  }

  async save(user) {
    const now = new Date().toISOString();
    const createdAt = user.createdAt || now;
    const document = {
      ...user,
      updatedAt: now
    };
    const { createdAt: _ignoredCreatedAt, ...updatableFields } = document;

    await this.collection.updateOne(
      { userId: document.userId },
      {
        $set: updatableFields,
        $setOnInsert: { createdAt }
      },
      { upsert: true }
    );

    return {
      ...document,
      createdAt
    };
  }
}

class MongoNotificationRepository {
  constructor(collection) {
    this.collection = collection;
    this.storageName = 'mongodb';
  }

  async init() {
    await this.collection.createIndex({ notificationId: 1 }, { unique: true, name: 'ux_notifications_notificationId' });
    await this.collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'ix_notifications_userId_createdAt' });
    await this.collection.createIndex({ eventId: 1 }, { name: 'ix_notifications_eventId' });
  }

  async save(notification) {
    const now = new Date().toISOString();
    const document = {
      ...notification,
      createdAt: notification.createdAt || now
    };

    await this.collection.updateOne(
      { notificationId: document.notificationId },
      { $set: document },
      { upsert: true }
    );

    return document;
  }

  async findByUserId(userId) {
    const documents = await this.collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    return documents.map((document) => stripInternalId(document));
  }

  async count() {
    return this.collection.countDocuments({});
  }
}

class MongoEventLedgerRepository {
  constructor(collection) {
    this.collection = collection;
    this.storageName = 'mongodb';
  }

  async init() {
    await this.collection.createIndex({ eventId: 1 }, { unique: true, name: 'ux_sync_event_ledger_eventId' });
    await this.collection.createIndex({ processedAt: -1 }, { name: 'ix_sync_event_ledger_processedAt' });
  }

  async markProcessed(eventId) {
    try {
      await this.collection.insertOne({
        eventId,
        processedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      if (error && error.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  async count() {
    return this.collection.countDocuments({});
  }
}

module.exports = {
  MongoUserRepository,
  MongoNotificationRepository,
  MongoEventLedgerRepository
};
