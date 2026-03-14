const {
  normalizeExternalEvent,
  syncFieldForStream
} = require('../domain/syncEvent');

function badRequest(message) {
  const error = new Error(message);
  error.code = 'BAD_REQUEST';
  error.statusCode = 400;
  return error;
}

function streamMetricKey(stream) {
  if (stream === 'booking.events') {
    return 'booking';
  }
  if (stream === 'payment.events') {
    return 'payment';
  }
  if (stream === 'flight.inventory.events') {
    return 'inventory';
  }
  return 'other';
}

class CustomerService {
  constructor(userRepository, notificationRepository, eventLedgerRepository, notificationEventPublisher, identityProfileProvider) {
    this.userRepository = userRepository;
    this.notificationRepository = notificationRepository;
    this.eventLedgerRepository = eventLedgerRepository;
    this.notificationEventPublisher = notificationEventPublisher || { publish: () => false };
    this.identityProfileProvider = identityProfileProvider || null;
    this.kafkaEnabled = false;
    this.kafkaMetrics = {
      consumed: {
        booking: 0,
        payment: 0,
        inventory: 0,
        other: 0
      },
      failedConsumed: {
        booking: 0,
        payment: 0,
        inventory: 0,
        other: 0
      },
      publishedNotificationEvents: 0,
      failedNotificationPublishes: 0
    };
  }

  async getMe(userId, actorType) {
    return this.ensureProfile(userId, actorType);
  }

  async updateMe(userId, actorType, payload) {
    const existing = await this.ensureProfile(userId, actorType);
    const updated = {
      ...existing,
      ...payload,
      userId,
      actorType
    };
    return this.userRepository.save(updated);
  }

  async requestMobileVerify(userId, actorType) {
    await this.ensureProfile(userId, actorType);
    return { challengeId: `MV-${Date.now()}`, userId, channel: 'sms' };
  }

  async confirmMobileVerify(userId, actorType) {
    const existing = await this.ensureProfile(userId, actorType);
    existing.mobileVerified = true;
    await this.userRepository.save(existing);
    return { verified: true, userId };
  }

  async sendNotification(type, payload, actorType, metadata = {}) {
    throw badRequest('notification endpoints have moved to notification-service');
  }

  async syncExternalEvent(stream, payload, fallbackActorType, correlationId) {
    const event = normalizeExternalEvent(stream, payload, fallbackActorType);
    const shouldProcess = await this.eventLedgerRepository.markProcessed(event.eventId);

    if (!shouldProcess) {
      return {
        accepted: true,
        duplicate: true,
        stream: event.stream,
        eventId: event.eventId,
        eventType: event.eventType
      };
    }

    const updatedProfile = await this.applySyncSideEffects(event);

    return {
      accepted: true,
      duplicate: false,
      stream: event.stream,
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      actorType: event.actorType,
      syncedAt: new Date().toISOString(),
      profileSyncVersion: updatedProfile.syncVersion
    };
  }

  async health(mode) {
    const storage = this.userRepository.storageName || 'in-memory';
    const processedEvents = await this.eventLedgerRepository.count();
    return {
      status: 'UP',
      details: {
        mode,
        service: 'customer-service',
        storage,
        sync: {
          processedEvents
        },
        kafka: {
          enabled: this.kafkaEnabled,
          consumed: this.kafkaMetrics.consumed,
          failedConsumed: this.kafkaMetrics.failedConsumed,
          publishedNotificationEvents: this.kafkaMetrics.publishedNotificationEvents,
          failedNotificationPublishes: this.kafkaMetrics.failedNotificationPublishes
        }
      }
    };
  }

  setKafkaEnabled(value) {
    this.kafkaEnabled = Boolean(value);
  }

  setNotificationEventPublisher(publisher) {
    this.notificationEventPublisher = publisher || { publish: () => false };
  }

  markInboundEventConsumed(stream) {
    const key = streamMetricKey(stream);
    this.kafkaMetrics.consumed[key] += 1;
  }

  markInboundEventFailed(stream) {
    const key = streamMetricKey(stream);
    this.kafkaMetrics.failedConsumed[key] += 1;
  }

  async publishNotificationEvent() {
    return false;
  }

  async applySyncSideEffects(event) {
    const existing = await this.ensureProfile(event.userId, event.actorType);
    const field = syncFieldForStream(event.stream);
    const syncVersion = (existing.syncVersion || 0) + 1;

    const updated = {
      ...existing,
      actorType: event.actorType,
      syncVersion,
      syncState: {
        ...(existing.syncState || {}),
        [field]: {
          eventId: event.eventId,
          eventType: event.eventType,
          stream: event.stream,
          occurredAt: event.occurredAt,
          source: event.source,
          bookingId: event.bookingId,
          paymentId: event.paymentId,
          flightId: event.flightId,
          holdId: event.holdId,
          seatCount: event.seatCount,
          status: event.status,
          reason: event.reason
        }
      }
    };

    return this.userRepository.save(updated);
  }

  async ensureProfile(userId, actorType) {
    const existing = await this.userRepository.findById(userId);
    if (existing) {
      if (!this.shouldRefreshFromIdentity(existing)) {
        return existing;
      }

      const hydratedExisting = await this.hydrateProfileFromIdentity(userId, actorType, existing);
      if (hydratedExisting) {
        return hydratedExisting;
      }

      return existing;
    }

    const hydratedProfile = await this.hydrateProfileFromIdentity(userId, actorType);
    if (hydratedProfile) {
      return hydratedProfile;
    }

    return this.userRepository.save(this.createFallbackProfile(userId, actorType));
  }

  async hydrateProfileFromIdentity(userId, actorType, existing = null) {
    if (!this.identityProfileProvider) {
      return null;
    }

    try {
      const identityProfile = await this.identityProfileProvider(userId);
      if (!identityProfile) {
        return null;
      }

      const mergedProfile = {
        ...(existing || this.createFallbackProfile(userId, actorType)),
        userId,
        actorType,
        email: identityProfile.email || existing?.email || `${userId.toLowerCase()}@voyagevibes.dev`,
        firstName: identityProfile.firstName || existing?.firstName || '',
        lastName: identityProfile.lastName || existing?.lastName || '',
        mobile: identityProfile.mobile || existing?.mobile || '',
        mobileVerified: identityProfile.mobileVerified ?? existing?.mobileVerified ?? false,
        name: this.composeDisplayName(
          identityProfile.firstName || existing?.firstName || '',
          identityProfile.lastName || existing?.lastName || '',
          existing?.name
        ),
        preferences: existing?.preferences || {}
      };

      return this.userRepository.save(mergedProfile);
    } catch (_error) {
      return null;
    }
  }

  shouldRefreshFromIdentity(profile) {
    if (!profile) {
      return true;
    }

    const firstName = String(profile.firstName || '').trim();
    const lastName = String(profile.lastName || '').trim();
    const email = String(profile.email || '').trim().toLowerCase();

    return !firstName
      || !lastName
      || (firstName === 'Customer' && lastName === 'User')
      || email.endsWith('@voyagevibes.dev');
  }

  createFallbackProfile(userId, actorType) {
    const firstName = actorType === 'corp' ? 'Corp' : 'Customer';
    const lastName = actorType === 'corp' ? 'Staff' : 'User';

    return {
      userId,
      actorType,
      name: this.composeDisplayName(firstName, lastName),
      firstName,
      lastName,
      email: `${userId.toLowerCase()}@voyagevibes.dev`,
      mobile: '+910000000000',
      mobileVerified: false,
      preferences: {}
    };
  }

  composeDisplayName(firstName, lastName, fallback = '') {
    const displayName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
    return displayName || fallback || 'VoyageVibes User';
  }
}

module.exports = { CustomerService };
