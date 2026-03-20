import type { Airport, FlightSearchRequest } from '../../types';
import { CABIN_CLASSES, TRIP_TYPES } from '../../constants';
import { CalendarIcon, LocationIcon, PassengerIcon, PlaneIcon } from '../icons';
import { Button, Card, SectionEyebrow } from '../ui';
import { cn, formatDate, getTotalPassengers } from '../../lib/formatters';

interface SearchFormProps {
  airports: Airport[];
  compact?: boolean;
  errorMessage?: string | null;
  isBusy?: boolean;
  onChange: (criteria: FlightSearchRequest) => void;
  onSubmit: (criteria: FlightSearchRequest) => void;
  value: FlightSearchRequest;
}

const today = new Date().toISOString().slice(0, 10);

const updatePassengers = (
  value: FlightSearchRequest,
  key: keyof FlightSearchRequest['passengers'],
  amount: number
) => ({
  ...value,
  passengers: {
    ...value.passengers,
    [key]: amount,
  },
});

export function SearchForm({
  airports,
  compact = false,
  errorMessage,
  isBusy,
  onChange,
  onSubmit,
  value,
}: SearchFormProps) {
  const airportSuggestions = airports.map((airport) => `${airport.code} - ${airport.city}`);

  return (
    <Card className={cn('glass-panel p-6 sm:p-7', compact && 'p-5')}>
      <SectionEyebrow>{compact ? 'Modify search' : 'Plan your trip'}</SectionEyebrow>
      <div className="mt-4 flex flex-wrap gap-2">
        {TRIP_TYPES.map((tripType) => (
          <button
            key={tripType.value}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition duration-300',
              value.tripType === tripType.value
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
            onClick={() => onChange({ ...value, tripType: tripType.value as FlightSearchRequest['tripType'] })}
            type="button"
          >
            {tripType.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <LocationIcon className="h-4 w-4" />
            From
          </div>
          <input
            className="mt-3 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            list="vv-airports"
            onChange={(event) => onChange({ ...value, fromCode: event.target.value.toUpperCase() })}
            placeholder="BOM - Mumbai"
            value={value.fromCode}
          />
        </label>

        <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <PlaneIcon className="h-4 w-4" />
            To
          </div>
          <input
            className="mt-3 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            list="vv-airports"
            onChange={(event) => onChange({ ...value, toCode: event.target.value.toUpperCase() })}
            placeholder="DEL - Delhi"
            value={value.toCode}
          />
        </label>

        <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <CalendarIcon className="h-4 w-4" />
            Departure
          </div>
          <input
            className="mt-3 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none dark:text-white"
            min={today}
            onChange={(event) => onChange({ ...value, departureDate: event.target.value })}
            type="date"
            value={typeof value.departureDate === 'string' ? value.departureDate : value.departureDate.toISOString().slice(0, 10)}
          />
        </label>

        <label className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <PassengerIcon className="h-4 w-4" />
            Cabin
          </div>
          <select
            className="mt-3 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none dark:text-white"
            onChange={(event) => onChange({ ...value, classOfTravel: event.target.value as FlightSearchRequest['classOfTravel'] })}
            value={value.classOfTravel}
          >
            {CABIN_CLASSES.map((cabin) => (
              <option key={cabin.value} value={cabin.value}>
                {cabin.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {([
          ['adults', 'Adults', 1],
          ['children', 'Children', 0],
          ['infants', 'Infants', 0],
        ] as const).map(([key, label, min]) => (
          <label key={key} className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
            <input
              className="mt-3 w-full bg-transparent text-lg font-semibold text-slate-900 outline-none dark:text-white"
              min={min}
              onChange={(event) => onChange(updatePassengers(value, key, Number(event.target.value)))}
              type="number"
              value={value.passengers[key]}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-950 px-5 py-4 text-white dark:bg-slate-900">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trip preview</p>
          <p className="mt-1 text-sm font-medium text-white">
            {value.fromCode} to {value.toCode} / {formatDate(value.departureDate)} / {getTotalPassengers(value.passengers)} travellers
          </p>
        </div>
        <Button
          className="min-w-[140px]"
          onClick={() => onSubmit(value)}
          size="lg"
          type="button"
          disabled={isBusy}
        >
          {isBusy ? 'Searching...' : 'Search flights'}
        </Button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <datalist id="vv-airports">
        {airportSuggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </Card>
  );
}
