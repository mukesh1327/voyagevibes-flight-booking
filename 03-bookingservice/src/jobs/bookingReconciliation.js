import { Booking } from '../models/bookingModel.js';
import { bookingStatuses } from '../models/bookingStatus.js';
import { confirmFlightHold, releaseFlightHold } from '../services/flightClient.js';
import { wasBookingPaid } from '../services/paymentClient.js';

const SWEEP_INTERVAL_MS = Number(process.env.RECONCILIATION_INTERVAL_MS || 30000);

// A booking left in PAYMENT_PENDING past its hold window usually means the checkout was
// abandoned. But it can also mean payment succeeded and the direct payment-service ->
// booking-service confirmation call never landed (a network blip, booking-service briefly
// down) - checking payment-service here closes that gap instead of failing a paid booking.
export async function reconcileStaleBookings() {
  const staleBookings = await Booking.find({
    status: bookingStatuses.paymentPending,
    holdExpiresAt: { $lt: new Date() },
  }).limit(100);

  for (const booking of staleBookings) {
    const wasPaid = await wasBookingPaid(booking._id).catch(() => false);

    if (wasPaid) {
      booking.status = bookingStatuses.confirmed;
      await booking.save();
      confirmFlightHold(booking.holdId).catch((error) => {
        console.error('Failed to confirm flight hold during reconciliation', booking.holdId, error);
      });
      continue;
    }

    booking.status = bookingStatuses.failed;
    await booking.save();

    try {
      await releaseFlightHold(booking.holdId);
    } catch (error) {
      console.error('Failed to release flight hold during reconciliation', booking.holdId, error);
    }
  }

  return staleBookings.length;
}

export function startReconciliationJob() {
  const timer = setInterval(() => {
    reconcileStaleBookings()
      .then((count) => {
        if (count > 0) {
          console.log(`booking reconciliation: expired ${count} stale booking(s)`);
        }
      })
      .catch((error) => {
        console.error('booking reconciliation sweep failed', error);
      });
  }, SWEEP_INTERVAL_MS);

  timer.unref?.();
  return timer;
}
