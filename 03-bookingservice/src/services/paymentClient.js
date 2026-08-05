import { Agent } from 'undici';
import { config } from '../config/index.js';

// The realm's certificate is self-signed in this local/demo deployment.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

let cachedServiceToken = null;
let cachedServiceTokenExpiresAt = 0;

// Authenticates as a service account (Keycloak client-credentials grant) so calls to
// payment-service's role-gated lookup endpoint carry a real token instead of a caller-supplied
// role header the endpoint no longer trusts.
const getServiceToken = async () => {
  const now = Date.now();
  if (cachedServiceToken && now < cachedServiceTokenExpiresAt) {
    return cachedServiceToken;
  }

  const response = await fetch(config.keycloakTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.keycloakServiceClientId,
      client_secret: config.keycloakServiceClientSecret,
    }),
    dispatcher: insecureAgent,
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain service token (HTTP ${response.status})`);
  }

  const body = await response.json();
  cachedServiceToken = body.access_token;
  cachedServiceTokenExpiresAt = now + Math.max(body.expires_in - 15, 5) * 1000;
  return cachedServiceToken;
};

export const refundPayment = async (bookingId) => {
  const response = await fetch(`${config.paymentServiceUrl}/payments/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  return response.ok;
};

// Used by the reconciliation sweep to tell a genuinely-abandoned checkout apart from one
// where payment succeeded but the direct payment-service -> booking-service call never landed.
export const wasBookingPaid = async (bookingId) => {
  const token = await getServiceToken();
  const response = await fetch(`${config.paymentServiceUrl}/payments/orders/by-booking/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return false;
  }
  const body = await response.json();
  return body.status === 'PAID';
};
