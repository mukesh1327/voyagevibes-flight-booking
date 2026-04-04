const database = db.getSiblingDB('customerdb');

for (const collectionName of ['users', 'notifications', 'sync_event_ledger']) {
  if (!database.getCollectionNames().includes(collectionName)) {
    database.createCollection(collectionName);
  }
}

database.users.createIndex(
  { userId: 1 },
  { unique: true, name: 'ux_users_userId' }
);
database.users.createIndex(
  { actorType: 1 },
  { name: 'ix_users_actorType' }
);

database.notifications.createIndex(
  { notificationId: 1 },
  { unique: true, name: 'ux_notifications_notificationId' }
);
database.notifications.createIndex(
  { userId: 1, createdAt: -1 },
  { name: 'ix_notifications_userId_createdAt' }
);
database.notifications.createIndex(
  { eventId: 1 },
  { name: 'ix_notifications_eventId' }
);

database.sync_event_ledger.createIndex(
  { eventId: 1 },
  { unique: true, name: 'ux_sync_event_ledger_eventId' }
);
database.sync_event_ledger.createIndex(
  { processedAt: -1 },
  { name: 'ix_sync_event_ledger_processedAt' }
);
