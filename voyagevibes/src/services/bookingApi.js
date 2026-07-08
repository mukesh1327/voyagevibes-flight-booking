import { getStoredToken } from './auth';

const jsonHeaders = (user) => {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (user?.subject) {
    headers['x-user-id'] = user.subject;
  }

  return headers;
};

const readJson = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.detail || `Request failed with status ${response.status}`);
  }
  return body;
};

export const searchFlights = async ({ from, to, date }) => {
  const params = new URLSearchParams({ from, to, date, sort: 'price' });
  const response = await fetch(`/api/v1/flights/search?${params.toString()}`);
  return readJson(response);
};

export const createBooking = async ({ flight, passenger, user }) => {
  const normalizedPassenger = {
    name: passenger.name.trim(),
    email: passenger.email.trim().toLowerCase(),
    age: Number(passenger.age),
  };

  const response = await fetch('/api/v1/bookings', {
    method: 'POST',
    headers: jsonHeaders(user),
    body: JSON.stringify({
      flightId: flight.id,
      amount: Number(flight.price),
      passengers: [normalizedPassenger],
    }),
  });
  return readJson(response);
};

export const createPaymentOrder = async ({ booking }) => {
  const response = await fetch('/api/v1/payments/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: booking.id,
      amount: booking.amount,
      currency: 'INR',
    }),
  });
  return readJson(response);
};

export const getBooking = async ({ booking, user }) => {
  const response = await fetch(`/api/v1/bookings/${booking.id}`, {
    headers: jsonHeaders(user),
  });
  return readJson(response);
};

export const verifyPayment = async ({ booking, order, paymentResult }) => {
  const response = await fetch('/api/v1/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: booking.id,
      razorpay_order_id: order.razorpay_order_id,
      razorpay_payment_id: paymentResult.razorpay_payment_id,
      razorpay_signature: paymentResult.razorpay_signature,
    }),
  });
  return readJson(response);
};

export const markBookingConfirmed = async ({ booking, payment, user }) => {
  const response = await fetch(`/api/v1/bookings/${booking.id}/status`, {
    method: 'PATCH',
    headers: jsonHeaders(user),
    body: JSON.stringify({
      status: payment.signature_valid ? 'CONFIRMED' : 'FAILED',
      paymentId: payment.razorpay_payment_id,
    }),
  });
  return readJson(response);
};

export const sendConfirmation = async ({ booking, passenger }) => {
  const response = await fetch('/api/v1/notifications/booking-confirmed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: booking.id,
      email: passenger.email,
      name: passenger.name,
    }),
  });
  return readJson(response);
};
