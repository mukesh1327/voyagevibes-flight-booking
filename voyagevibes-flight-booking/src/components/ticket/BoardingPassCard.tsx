import type { Booking, FlightWithPrice, User } from '../../types';
import { Button, Card, SectionEyebrow, StatusBadge } from '../ui';
import { formatCurrency, formatDate, formatTime } from '../../lib/formatters';

interface BoardingPassCardProps {
  booking: Booking;
  flight: FlightWithPrice;
  paymentId: string;
  seats: string[];
  user: User | null;
}

export function BoardingPassCard({ booking, flight, paymentId, seats, user }: BoardingPassCardProps) {
  const segment = flight.flight.segments[0];

  return (
    <Card className="glass-panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-6 sm:p-8">
          <SectionEyebrow>Boarding pass</SectionEyebrow>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-slate-950 dark:text-white">
                {segment.departureAirport.code} to {segment.arrivalAirport.code}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{segment.airline.name} / {segment.aircraft.model}</p>
            </div>
            <StatusBadge tone="success">confirmed</StatusBadge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50/90 p-4 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Passenger</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {user ? `${user.firstName} ${user.lastName}` : 'VoyageVibes Guest'}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50/90 p-4 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Date</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatDate(segment.departureTime)}</p>
            </div>
            <div className="rounded-3xl bg-slate-50/90 p-4 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Seats</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{seats.join(', ') || 'Assigned at airport'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 p-5 dark:border-slate-700">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Boarding</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatTime(new Date(new Date(segment.departureTime).getTime() - 45 * 60 * 1000))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Departure</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatTime(segment.departureTime)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Arrival</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatTime(segment.arrivalTime)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fare</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatCurrency(booking.pricing.totalPrice, booking.pricing.currency)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-panel border-t border-slate-200/80 p-6 dark:border-slate-800 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ticket details</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">PNR</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{booking.bookingReference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment ID</p>
                  <p className="mt-2 break-all text-sm font-medium text-slate-700 dark:text-slate-200">{paymentId}</p>
                </div>
                <div className="qr-grid mt-6 rounded-[28px] p-4" />
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Button className="w-full" onClick={() => window.print()}>
                Print ticket
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => navigator.clipboard.writeText(booking.bookingReference)}>
                Copy booking reference
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
