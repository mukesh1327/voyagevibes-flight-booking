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
