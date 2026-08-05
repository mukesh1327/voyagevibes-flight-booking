export const bookingStatuses = Object.freeze({
  paymentPending: 'PAYMENT_PENDING',
  confirmed: 'CONFIRMED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
});

// CANCELLED is deliberately not a target of any transition here: it's only reachable through
// the dedicated cancel flow (cancelBooking), which carries its own hold-release/refund side effects.
export const allowedTransitions = new Map([
  [bookingStatuses.paymentPending, new Set([bookingStatuses.confirmed, bookingStatuses.failed])],
  [bookingStatuses.failed, new Set([bookingStatuses.paymentPending])],
]);

export const cancellableStatuses = new Set([bookingStatuses.paymentPending, bookingStatuses.confirmed]);
