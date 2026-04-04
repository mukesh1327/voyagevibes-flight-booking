const express = require('express');
const { InMemoryUserRepository } = require('../infrastructure/inMemoryUserRepository');
const { InMemoryNotificationRepository } = require('../infrastructure/inMemoryNotificationRepository');
const { InMemoryEventLedgerRepository } = require('../infrastructure/inMemoryEventLedgerRepository');
const { CustomerService } = require('../application/customerService');
const { resolveContext } = require('./context');
const { SyncStream } = require('../domain/syncEvent');
const { init: initOtel, middleware: otelMiddleware } = require('../observability/otel');

function withHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.statusCode || 500).json({
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      });
    }
  };
}

function createApp(options = {}) {
  initOtel();
  const app = express();
  app.use(express.json());
  app.use(otelMiddleware());

  const service = options.service || new CustomerService(
    new InMemoryUserRepository(),
    new InMemoryNotificationRepository(),
    new InMemoryEventLedgerRepository()
  );
  app.locals.customerService = service;

  app.get('/api/v1/health', withHandler(async (_req, res) => res.json(await service.health('health'))));
  app.get('/api/v1/health/live', withHandler(async (_req, res) => res.json(await service.health('live'))));
  app.get('/api/v1/health/ready', withHandler(async (_req, res) => res.json(await service.health('ready'))));

  app.get('/api/v1/users/me', withHandler(async (req, res) => {
    const { userId, actorType } = resolveContext(req);
    res.json(await service.getMe(userId, actorType));
  }));

  app.patch('/api/v1/users/me', withHandler(async (req, res) => {
    const { userId, actorType } = resolveContext(req);
    res.json(await service.updateMe(userId, actorType, req.body || {}));
  }));

  app.post('/api/v1/users/me/mobile/verify/request', withHandler(async (req, res) => {
    const { userId, actorType } = resolveContext(req);
    res.json(await service.requestMobileVerify(userId, actorType));
  }));

  app.post('/api/v1/users/me/mobile/verify/confirm', withHandler(async (req, res) => {
    const { userId, actorType } = resolveContext(req);
    res.json(await service.confirmMobileVerify(userId, actorType));
  }));

  app.post('/api/v1/sync/booking-events', withHandler(async (req, res) => {
    const { actorType, correlationId } = resolveContext(req);
    res.json(await service.syncExternalEvent(SyncStream.BOOKING, req.body || {}, actorType, correlationId));
  }));

  app.post('/api/v1/sync/payment-events', withHandler(async (req, res) => {
    const { actorType, correlationId } = resolveContext(req);
    res.json(await service.syncExternalEvent(SyncStream.PAYMENT, req.body || {}, actorType, correlationId));
  }));

  app.post('/api/v1/sync/inventory-events', withHandler(async (req, res) => {
    const { actorType, correlationId } = resolveContext(req);
    res.json(await service.syncExternalEvent(SyncStream.INVENTORY, req.body || {}, actorType, correlationId));
  }));

  return app;
}

module.exports = { createApp };
