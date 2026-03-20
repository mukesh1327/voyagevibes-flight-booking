import type { FlightWithPrice } from '../../types';
import { CalendarIcon, PlaneIcon, TicketIcon } from '../icons';
import { Button, Card, StatusBadge } from '../ui';
import { formatCurrency, formatDate, formatDuration, formatTime, getStopLabel } from '../../lib/formatters';

interface FlightResultCardProps {
  flight: FlightWithPrice;
  index: number;
  onPreview: () => void;
  onSelect: () => void;
}

const getLabel = (index: number) => {
  if (index === 0) {
    return 'Best';
  }
  if (index === 1) {
    return 'Fast';
  }
  if (index === 2) {
    return 'Value';
  }
  return 'Option';
};

export function FlightResultCard({ flight, index, onPreview, onSelect }: FlightResultCardProps) {
  const segment = flight.flight.segments[0];

  return (
    <Card className="glass-panel fade-up overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={index === 0 ? 'success' : 'info'}>{getLabel(index)}</StatusBadge>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{segment.airline.name}</p>
            <p className="text-sm text-slate-400">/ {getStopLabel(flight.flight.totalStops)}</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-center">
            <div>
              <p className="text-3xl font-semibold text-slate-950 dark:text-white">{formatTime(segment.departureTime)}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{segment.departureAirport.code}</p>
            </div>

            <div className="flex min-w-[130px] flex-col items-center">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{formatDuration(flight.flight.totalDuration)}</p>
              <div className="mt-2 h-px w-full bg-gradient-to-r from-blue-500 via-slate-300 to-indigo-500 dark:via-slate-700" />
              <PlaneIcon className="mt-2 h-4 w-4 text-blue-600 dark:text-blue-300" />
            </div>

            <div className="lg:text-right">
              <p className="text-3xl font-semibold text-slate-950 dark:text-white">{formatTime(segment.arrivalTime)}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{segment.arrivalAirport.code}</p>
            </div>

            <div className="rounded-3xl bg-slate-50/90 p-4 dark:bg-slate-900/70">
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                {formatCurrency(flight.pricing.totalPrice, flight.pricing.currency)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{flight.pricing.fareFamily}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-300">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
              <CalendarIcon className="h-4 w-4" />
              {formatDate(segment.departureTime)}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
              <TicketIcon className="h-4 w-4" />
              {flight.availability.seats} seats left
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:min-w-[200px]">
          <Button className="w-full" onClick={onSelect}>
            Select flight
          </Button>
          <Button className="w-full" onClick={onPreview} variant="secondary">
            Review details
          </Button>
        </div>
      </div>
    </Card>
  );
}
