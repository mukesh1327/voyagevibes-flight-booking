import { config } from '../config/index.js';

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
  const response = await fetch(`${config.paymentServiceUrl}/payments/orders/by-booking/${bookingId}`, {
    headers: { 'x-user-roles': 'platform-admin' },
  });
  if (!response.ok) {
    return false;
  }
  const body = await response.json();
  return body.status === 'PAID';
};
