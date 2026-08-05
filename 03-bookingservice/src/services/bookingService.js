import { Booking } from '../models/bookingModel.js';
import { allowedTransitions, bookingStatuses, cancellableStatuses } from '../models/bookingStatus.js';
import { cancelFlightHold, confirmFlightHold, holdFlightInventory, releaseFlightHold } from './flightClient.js';
import { toDto } from './bookingMapper.js';
import { refundPayment } from './paymentClient.js';
import { normalizePassengers, validateBooking } from './bookingValidation.js';

export async function createBooking({ body, userId }) {
  const validationError = validateBooking(body);
  if (validationError) {
    const error = new Error(validationError);
    error.status = 400;
    throw error;
  }

  // Booking owns the customer order, while Flight Service owns live seat inventory.
  const hold = await holdFlightInventory({
    flightId: body.flightId.trim(),
    seats: body.passengers.length,
  });

  const booking = await Booking.create({
    userId,
    flightId: body.flightId.trim(),
    flightNo: hold.flightNo,
    holdId: hold.holdId,
    holdExpiresAt: new Date(hold.expiresAt),
    seatsHeld: hold.seatsHeld,
    seatsRemaining: hold.seatsRemaining,
    passengers: normalizePassengers(body.passengers),
    amount: Number(hold.price) * Number(hold.seatsHeld),
  });

  return toDto(booking);
}

export async function getBooking({ id, userId }) {
  const booking = await Booking.findOne({ _id: id, userId }).lean();
  return booking ? toDto(booking) : null;
}

export async function listBookingsForUser({ userId, limit = 50 }) {
  const bookings = await Booking.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return bookings.map(toDto);
}

export async function searchBookingsForSupport({ bookingId, email }) {
  const filter = {};
  if (bookingId?.trim()) {
    filter._id = bookingId.trim();
  }
  if (email?.trim()) {
    filter['passengers.email'] = email.trim().toLowerCase();
  }

  if (Object.keys(filter).length === 0) {
    const error = new Error('bookingId or email is required');
    error.status = 400;
    throw error;
  }

  // Support-desk lookup stays bounded and indexed-friendly for day-one operations.
  const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(20).lean();
  return bookings.map(toDto);
}

export async function updateBookingStatus({ id, userId, status, paymentId }) {
  const booking = await Booking.findOne({ _id: id, userId });
  if (!booking) {
    return null;
  }

  // Both payment-service (server-to-server, right after verify) and the browser can reach this
  // endpoint for the same outcome. Treat a repeat call for the current status as a no-op instead
  // of a conflict, so whichever caller arrives second doesn't see a spurious error.
  if (booking.status !== status) {
    if (!allowedTransitions.get(booking.status)?.has(status)) {
      const error = new Error(`Cannot move booking from ${booking.status} to ${status}`);
      error.status = 409;
      throw error;
    }

    booking.status = status;
    booking.paymentId = paymentId || booking.paymentId;
    await booking.save();
  }

  // Keep flight-service's hold in sync with the booking outcome. Best-effort, and retried on
  // every call (not just the one that changed the status) in case an earlier sync attempt failed;
  // the hold sweep in flight-service is the ultimate backstop.
  if (status === bookingStatuses.confirmed) {
    confirmFlightHold(booking.holdId).catch((error) => {
      console.error('Failed to confirm flight hold', booking.holdId, error);
    });
  } else if (status === bookingStatuses.failed) {
    releaseFlightHold(booking.holdId).catch((error) => {
      console.error('Failed to release flight hold', booking.holdId, error);
    });
  }

  return toDto(booking);
}

export async function cancelBooking({ id, userId }) {
  const booking = await Booking.findOne({ _id: id, userId });
  if (!booking) {
    return null;
  }

  if (!cancellableStatuses.has(booking.status)) {
    const error = new Error(`Cannot cancel a booking with status ${booking.status}`);
    error.status = 409;
    throw error;
  }

  const wasConfirmed = booking.status === bookingStatuses.confirmed;
  booking.status = bookingStatuses.cancelled;
  await booking.save();

  // Best-effort: reclaim the seat, and if the booking had already been paid for, request a
  // refund. Neither depends on the cancellation itself having already been persisted.
  cancelFlightHold(booking.holdId).catch((error) => {
    console.error('Failed to cancel flight hold', booking.holdId, error);
  });

  if (wasConfirmed) {
    refundPayment(booking.id).catch((error) => {
      console.error('Failed to request refund', booking.id, error);
    });
  }

  return toDto(booking);
}
