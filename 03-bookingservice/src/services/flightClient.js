import { config } from '../config/index.js';

export const holdFlightInventory = async ({ flightId, seats }) => {
  const response = await fetch(`${config.flightServiceUrl}/flights/${flightId}/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seats }),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.message || 'Selected flight is no longer available';
    const error = new Error(message);
    error.status = response.status === 409 ? 409 : 502;
    throw error;
  }

  return body;
};

// Best-effort sync with flight-service's hold: the hold sweep is the backstop if this call
// fails or the process crashes before it runs, so callers should not treat failures as fatal.
export const confirmFlightHold = async (holdId) => {
  const response = await fetch(`${config.flightServiceUrl}/flights/holds/${holdId}/confirm`, {
    method: 'POST',
  });
  return response.ok;
};

export const releaseFlightHold = async (holdId) => {
  const response = await fetch(`${config.flightServiceUrl}/flights/holds/${holdId}/release`, {
    method: 'POST',
  });
  return response.ok;
};

export const cancelFlightHold = async (holdId) => {
  const response = await fetch(`${config.flightServiceUrl}/flights/holds/${holdId}/cancel`, {
    method: 'POST',
  });
  return response.ok;
};
