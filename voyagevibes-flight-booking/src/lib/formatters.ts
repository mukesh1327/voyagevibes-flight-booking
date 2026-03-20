import type { FlightSearchRequest, PassengerInfo, User } from '../types';

export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const formatCurrency = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
}).format(amount || 0);

export const formatDate = (value: Date | string | undefined) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(value ? new Date(value) : new Date());

export const formatTime = (value: Date | string | undefined) => new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
}).format(value ? new Date(value) : new Date());

export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export const getTotalPassengers = (passengers: FlightSearchRequest['passengers']) => (
  Math.max((passengers.adults || 0) + (passengers.children || 0) + (passengers.infants || 0), 1)
);

export const initials = (user?: User | null) => `${user?.firstName?.[0] || 'V'}${user?.lastName?.[0] || 'V'}`.toUpperCase();

export const getStopLabel = (stops: number) => {
  if (stops === 0) {
    return 'Non-stop';
  }
  if (stops === 1) {
    return '1 stop';
  }
  return `${stops} stops`;
};

const buildPassengerTypes = (criteria: FlightSearchRequest) => ([
  ...Array.from({ length: Math.max(criteria.passengers.adults || 0, 1) }, () => 'adult' as const),
  ...Array.from({ length: criteria.passengers.children || 0 }, () => 'child' as const),
  ...Array.from({ length: criteria.passengers.infants || 0 }, () => 'infant' as const),
]);

export const buildPassengerShells = (criteria: FlightSearchRequest, user?: User | null): PassengerInfo[] => (
  buildPassengerTypes(criteria).map((type, index) => ({
    title: type === 'adult' ? 'Mr' : 'Ms',
    firstName: index === 0 ? user?.firstName || '' : '',
    lastName: index === 0 ? user?.lastName || '' : '',
    dateOfBirth: new Date('1990-01-01'),
    nationality: 'IN',
    email: user?.email || 'guest@voyagevibes.dev',
    phone: user?.phone || '+910000000000',
    type,
  }))
);
