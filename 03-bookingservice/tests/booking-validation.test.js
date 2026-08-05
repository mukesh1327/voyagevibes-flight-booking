import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRealmRoles } from '../src/middleware/auth.js';
import { allowedTransitions, validateBooking } from '../src/server.js';

test('booking validation accepts a minimal booking', () => {
  const error = validateBooking({
    flightId: 'flight-1',
    amount: 5000,
    passengers: [{ name: 'Mukesh', email: 'mukesh@example.com', age: 30 }],
  });

  assert.equal(error, null);
});

test('booking validation rejects empty passengers', () => {
  const error = validateBooking({ flightId: 'flight-1', amount: 5000, passengers: [] });
  assert.equal(error, 'At least one passenger is required');
});

test('booking validation rejects invalid passenger email', () => {
  const error = validateBooking({
    flightId: 'flight-1',
    amount: 5000,
    passengers: [{ name: 'Mukesh', email: 'not-email', age: 30 }],
  });

  assert.equal(error, 'Valid passenger email is required');
});

test('booking status transitions are explicit and bounded', () => {
  assert.equal(allowedTransitions.get('PAYMENT_PENDING').has('CONFIRMED'), true);
  assert.equal(allowedTransitions.get('CONFIRMED'), undefined);
});

test('realm role extraction from a decoded token is case-insensitive', () => {
  const roles = parseRealmRoles({ realm_access: { roles: ['support-desk', 'FINANCE-OPS', 'platform-admin'] } });

  assert.equal(roles.has('support-desk'), true);
  assert.equal(roles.has('finance-ops'), true);
  assert.equal(roles.has('platform-admin'), true);
  assert.equal(roles.size, 3);
});

test('realm role extraction handles a token with no realm_access claim', () => {
  const roles = parseRealmRoles({});
  assert.equal(roles.size, 0);
});
