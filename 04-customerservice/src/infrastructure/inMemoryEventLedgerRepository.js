class InMemoryEventLedgerRepository {
  constructor() {
    this.storageName = 'in-memory';
    this.eventIds = new Set();
  }

  markProcessed(eventId) {
    if (this.eventIds.has(eventId)) {
      return false;
    }

    this.eventIds.add(eventId);
    return true;
  }

  count() {
    return this.eventIds.size;
  }
}

module.exports = { InMemoryEventLedgerRepository };
