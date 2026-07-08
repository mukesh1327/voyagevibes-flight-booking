import { Router } from 'express';
import { requireAnyRole, requireUser } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import {
  createBooking,
  getBooking,
  searchBookingsForSupport,
  updateBookingStatus,
} from '../services/bookingService.js';

export const bookingRoutes = Router();

bookingRoutes.post('/bookings', requireUser, asyncRoute(async (request, response) => {
  const booking = await createBooking({ body: request.body, userId: request.userId });
  response.status(201).json(booking);
}));

bookingRoutes.get(
  '/bookings/support/search',
  requireUser,
  requireAnyRole('support-desk', 'booking-ops', 'platform-admin', 'super-admin'),
  asyncRoute(async (request, response) => {
    const bookings = await searchBookingsForSupport({
      bookingId: request.query.bookingId,
      email: request.query.email,
    });

    response.json({ items: bookings });
  }),
);

bookingRoutes.get('/bookings/:id', requireUser, asyncRoute(async (request, response) => {
  const booking = await getBooking({ id: request.params.id, userId: request.userId });
  if (!booking) {
    response.status(404).json({ message: 'Booking not found' });
    return;
  }
  response.json(booking);
}));

bookingRoutes.patch('/bookings/:id/status', requireUser, asyncRoute(async (request, response) => {
  const booking = await updateBookingStatus({
    id: request.params.id,
    userId: request.userId,
    status: request.body.status,
    paymentId: request.body.paymentId,
  });

  if (!booking) {
    response.status(404).json({ message: 'Booking not found' });
    return;
  }
  response.json(booking);
}));
