const { actorTypeFromContext } = require('../domain/actorType');

function resolveContext(req) {
  const userId = req.header('X-User-Id') || 'U-CUSTOMER-1';
  const actorType = actorTypeFromContext(req.header('X-Actor-Type'), req.header('X-Realm'));
  const correlationId = req.header('X-Correlation-Id') || null;
  return { userId, actorType, correlationId };
}

module.exports = { resolveContext };
