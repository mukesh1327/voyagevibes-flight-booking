import { getStoredToken } from './auth';

const readJson = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.detail || `Request failed with status ${response.status}`);
  }
  return body;
};

const headersFor = (user) => {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    'x-user-roles': (user?.corporateRoles || []).join(','),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (user?.subject) {
    headers['x-user-id'] = user.subject;
  }

  return headers;
};

export const searchFlightsForOps = async ({ from, to, date }) => {
  const params = new URLSearchParams({ from, to, date, sort: 'departure' });
  const response = await fetch(`/api/v1/flights/search?${params.toString()}`);
  return readJson(response);
};

export const updateFlightForOps = async ({ flightId, changes, user }) => {
  const response = await fetch(`/api/v1/flights/${flightId}`, {
    method: 'PATCH',
    headers: headersFor(user),
    body: JSON.stringify(changes),
  });
  return readJson(response);
};

export const searchBookingsForSupport = async ({ bookingId, email, user }) => {
  const params = new URLSearchParams();
  if (bookingId?.trim()) params.set('bookingId', bookingId.trim());
  if (email?.trim()) params.set('email', email.trim().toLowerCase());

  const response = await fetch(`/api/v1/bookings/support/search?${params.toString()}`, {
    headers: headersFor(user),
  });
  return readJson(response);
};

export const lookupPaymentForOps = async ({ bookingId, user }) => {
  const response = await fetch(`/api/v1/payments/orders/by-booking/${encodeURIComponent(bookingId)}`, {
    headers: headersFor(user),
  });
  return readJson(response);
};

export const checkServiceHealth = async () => {
  const services = [
    ['Flight', '/api/v1/flights/health'],
    ['Booking', '/api/v1/bookings/health'],
    ['Payment', '/api/v1/payments/health'],
    ['Notification', '/api/v1/notifications/health'],
  ];

  const results = await Promise.allSettled(
    services.map(async ([name, path]) => {
      const response = await fetch(path);
      const body = await readJson(response);
      return { name, path, status: body.status || 'UP' };
    }),
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      name: services[index][0],
      path: services[index][1],
      status: 'DOWN',
      message: result.reason.message,
    };
  });
};
