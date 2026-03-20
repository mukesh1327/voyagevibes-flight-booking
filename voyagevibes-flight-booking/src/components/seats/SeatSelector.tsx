import type { FlightWithPrice } from '../../types';
import { Button, Card, SectionEyebrow, StatusBadge } from '../ui';
import { buildSeatLayout } from '../../lib/seatMap';
import { cn, formatCurrency, formatDuration } from '../../lib/formatters';

interface SeatSelectorProps {
  errorMessage?: string | null;
  flight: FlightWithPrice;
  isBusy?: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSelectionChange: (seats: string[]) => void;
  passengerCount: number;
  selectedSeats: string[];
}

export function SeatSelector({
  errorMessage,
  flight,
  isBusy,
  onBack,
  onContinue,
  onSelectionChange,
  passengerCount,
  selectedSeats,
}: SeatSelectorProps) {
  const seatLayout = buildSeatLayout();

  const toggleSeat = (seatCode: string, isUnavailable: boolean) => {
    if (isUnavailable) {
      return;
    }

    if (selectedSeats.includes(seatCode)) {
      onSelectionChange(selectedSeats.filter((seat) => seat !== seatCode));
      return;
    }

    if (selectedSeats.length >= passengerCount) {
      return;
    }

    onSelectionChange([...selectedSeats, seatCode]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionEyebrow>Cabin map</SectionEyebrow>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              Select {passengerCount} seat{passengerCount > 1 ? 's' : ''}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">Available</StatusBadge>
            <StatusBadge tone="warning">Premium</StatusBadge>
            <StatusBadge tone="danger">Taken</StatusBadge>
          </div>
        </div>

        <div className="mt-6 rounded-[32px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:p-6">
          <div className="mx-auto max-w-xl rounded-[32px] bg-white/90 p-4 shadow-inner dark:bg-slate-950/80">
            {seatLayout.map((row) => (
              <div key={row.row} className="mb-3 grid grid-cols-[40px_1fr_32px_1fr_40px] items-center gap-2 last:mb-0">
                <span className="text-xs font-semibold text-slate-400">{row.row}</span>
                <div className="grid grid-cols-3 gap-2">
                  {row.left.map((seat) => {
                    const isSelected = selectedSeats.includes(seat.code);
                    return (
                      <button
                        key={seat.code}
                        className={cn(
                          'rounded-2xl px-3 py-3 text-xs font-semibold transition duration-200',
                          seat.unavailable && 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                          !seat.unavailable && !seat.premium && !isSelected && 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-200',
                          seat.premium && !isSelected && !seat.unavailable && 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200',
                          isSelected && 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        )}
                        onClick={() => toggleSeat(seat.code, seat.unavailable)}
                        type="button"
                      >
                        {seat.code}
                      </button>
                    );
                  })}
                </div>
                <div className="mx-auto h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div className="grid grid-cols-3 gap-2">
                  {row.right.map((seat) => {
                    const isSelected = selectedSeats.includes(seat.code);
                    return (
                      <button
                        key={seat.code}
                        className={cn(
                          'rounded-2xl px-3 py-3 text-xs font-semibold transition duration-200',
                          seat.unavailable && 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                          !seat.unavailable && !seat.premium && !isSelected && 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-200',
                          seat.premium && !isSelected && !seat.unavailable && 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200',
                          isSelected && 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        )}
                        onClick={() => toggleSeat(seat.code, seat.unavailable)}
                        type="button"
                      >
                        {seat.code}
                      </button>
                    );
                  })}
                </div>
                <span className="text-right text-xs font-semibold text-slate-400">{row.row}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <Card className="glass-panel p-6">
          <SectionEyebrow>Selected seats</SectionEyebrow>
          <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
            {selectedSeats.length ? selectedSeats.join(', ') : 'Choose your seats'}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {flight.flight.segments[0].departureAirport.code} to {flight.flight.segments[0].arrivalAirport.code} / {formatDuration(flight.flight.totalDuration)}
          </p>
          <div className="mt-5 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Total fare</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(flight.pricing.totalPrice, flight.pricing.currency)}</span>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {errorMessage}
            </div>
          ) : null}
          <Button
            className="mt-6 w-full"
            disabled={selectedSeats.length !== passengerCount || isBusy}
            onClick={onContinue}
          >
            {isBusy ? 'Locking seats...' : 'Continue to checkout'}
          </Button>
          <Button className="mt-3 w-full" onClick={onBack} variant="secondary">
            Back to details
          </Button>
        </Card>
      </aside>
    </div>
  );
}
