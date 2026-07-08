import { Booking } from '../models/bookingModel.js';
import { allowedTransitions } from '../models/bookingStatus.js';
import { holdFlightInventory } from './flightClient.js';
import { toDto } from './bookingMapper.js';
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

  if (!allowedTransitions.get(booking.status)?.has(status)) {
    const error = new Error(`Cannot move booking from ${booking.status} to ${status}`);
    error.status = 409;
    throw error;
  }

  booking.status = status;
  booking.paymentId = paymentId || booking.paymentId;
  await booking.save();
  return toDto(booking);
}
