import { useEffect, useState } from 'react';
import type { FlightSearchRequest, FlightWithPrice, PassengerInfo, PaymentMethod, User } from '../../types';
import { PAYMENT_METHODS } from '../../constants';
import { Button, Card, SectionEyebrow, StatusBadge } from '../ui';
import { buildPassengerShells, formatCurrency, formatDate, formatDuration } from '../../lib/formatters';

interface CheckoutPanelProps {
  bookingError?: string | null;
  contactUser: User | null;
  fareTotal: number;
  isAuthenticated: boolean;
  isSubmitting?: boolean;
  onBack: () => void;
  onSignIn: () => void;
  onSubmit: (payload: {
    passengers: PassengerInfo[];
    contactEmail: string;
    contactPhone: string;
    paymentMethod: PaymentMethod;
    specialRequests?: string;
  }) => void;
  searchCriteria: FlightSearchRequest;
  selectedFlight: FlightWithPrice;
  selectedSeats: string[];
}

interface PassengerDraft {
  title: PassengerInfo['title'];
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  type: PassengerInfo['type'];
}

export function CheckoutPanel({
  bookingError,
  contactUser,
  fareTotal,
  isAuthenticated,
  isSubmitting,
  onBack,
  onSignIn,
  onSubmit,
  searchCriteria,
  selectedFlight,
  selectedSeats,
}: CheckoutPanelProps) {
  const [contactEmail, setContactEmail] = useState(contactUser?.email || '');
  const [contactPhone, setContactPhone] = useState(contactUser?.phone || '');
  const [paymentType, setPaymentType] = useState<PaymentMethod['type']>('upi');
  const [specialRequests, setSpecialRequests] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [passengers, setPassengers] = useState<PassengerDraft[]>(() =>
    buildPassengerShells(searchCriteria, contactUser).map((passenger) => ({
      title: passenger.title,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      dateOfBirth: '',
      type: passenger.type,
    }))
  );

  useEffect(() => {
    setContactEmail(contactUser?.email || '');
    setContactPhone(contactUser?.phone || '');
  }, [contactUser]);

  useEffect(() => {
    setPassengers(
      buildPassengerShells(searchCriteria, contactUser).map((passenger) => ({
        title: passenger.title,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        dateOfBirth: '',
        type: passenger.type,
      }))
    );
  }, [contactUser, searchCriteria]);

  const updatePassenger = (index: number, patch: Partial<PassengerDraft>) => {
    setPassengers((current) => current.map((passenger, passengerIndex) => (
      passengerIndex === index
        ? { ...passenger, ...patch }
        : passenger
    )));
  };

  const submit = () => {
    if (!contactEmail || !contactPhone) {
      setLocalError('Please add contact email and phone so we can send your trip details.');
      return;
    }

    if (passengers.some((passenger) => !passenger.firstName || !passenger.lastName || !passenger.dateOfBirth)) {
      setLocalError('Please complete all traveller information before payment.');
      return;
    }

    setLocalError(null);
    onSubmit({
      contactEmail,
      contactPhone,
      paymentMethod: { type: paymentType },
      specialRequests,
      passengers: passengers.map((passenger, index) => ({
        title: passenger.title,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        dateOfBirth: new Date(passenger.dateOfBirth),
        nationality: 'IN',
        email: contactEmail,
        phone: contactPhone,
        type: passenger.type,
        passportNumber: undefined,
        passportExpiry: undefined,
        id: selectedSeats[index],
      })),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionEyebrow>Checkout</SectionEyebrow>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">Review travellers and pay securely</h1>
          </div>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>

        {!isAuthenticated ? (
          <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Faster checkout with Google sign-in</p>
                <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-200/80">Profile sync and booking history become easier once you sign in.</p>
              </div>
              <Button variant="secondary" onClick={onSignIn}>
                Sign in
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <StatusBadge tone="success">Profile connected</StatusBadge>
          </div>
        )}

        {(localError || bookingError) ? (
          <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {localError || bookingError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</span>
            <input
              className="mt-3 w-full bg-transparent text-base font-medium text-slate-900 outline-none dark:text-white"
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="name@email.com"
              value={contactEmail}
            />
          </label>
          <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</span>
            <input
              className="mt-3 w-full bg-transparent text-base font-medium text-slate-900 outline-none dark:text-white"
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="+91 9876543210"
              value={contactPhone}
            />
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {passengers.map((passenger, index) => (
            <div key={`${passenger.type}-${index}`} className="rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">Traveller {index + 1}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{passenger.type}</p>
                </div>
                <StatusBadge tone="info">{selectedSeats[index] || `Seat ${index + 1}`}</StatusBadge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  onChange={(event) => updatePassenger(index, { firstName: event.target.value })}
                  placeholder="First name"
                  value={passenger.firstName}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  onChange={(event) => updatePassenger(index, { lastName: event.target.value })}
                  placeholder="Last name"
                  value={passenger.lastName}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  onChange={(event) => updatePassenger(index, { dateOfBirth: event.target.value })}
                  type="date"
                  value={passenger.dateOfBirth}
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  onChange={(event) => updatePassenger(index, { title: event.target.value as PassengerInfo['title'] })}
                  value={passenger.title}
                >
                  {['Mr', 'Ms', 'Mrs', 'Dr'].map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <label className="mt-6 block rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Special requests</span>
          <textarea
            className="mt-3 min-h-[110px] w-full resize-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
            onChange={(event) => setSpecialRequests(event.target.value)}
            placeholder="Meals, assistance, or any booking notes."
            value={specialRequests}
          />
        </label>

        <div className="mt-6">
          <SectionEyebrow>Payment method</SectionEyebrow>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.value}
                className={
                  paymentType === method.value
                    ? 'rounded-3xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-700 transition duration-300 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200'
                    : 'rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-600 transition duration-300 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-400/20 dark:hover:text-blue-200'
                }
                onClick={() => setPaymentType(method.value as PaymentMethod['type'])}
                type="button"
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-slate-950 px-5 py-4 text-white dark:bg-slate-900">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Final amount</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(fareTotal, selectedFlight.pricing.currency)}</p>
            <p className="mt-1 text-sm text-slate-300">
              {selectedFlight.flight.segments[0].departureAirport.code} to {selectedFlight.flight.segments[0].arrivalAirport.code} / {formatDate(selectedFlight.flight.segments[0].departureTime)} / {formatDuration(selectedFlight.flight.totalDuration)}
            </p>
          </div>
          <Button className="min-w-[180px]" disabled={isSubmitting} onClick={submit}>
            {isSubmitting ? 'Processing...' : 'Pay now'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
