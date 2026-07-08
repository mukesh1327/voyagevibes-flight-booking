export const bookingStatuses = Object.freeze({
  paymentPending: 'PAYMENT_PENDING',
  confirmed: 'CONFIRMED',
  failed: 'FAILED',
});

export const allowedTransitions = new Map([
  [bookingStatuses.paymentPending, new Set([bookingStatuses.confirmed, bookingStatuses.failed])],
  [bookingStatuses.failed, new Set([bookingStatuses.paymentPending])],
]);
