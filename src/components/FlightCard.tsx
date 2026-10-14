import { Armchair, CheckCircle2 } from 'lucide-react';
import { CABIN_LABELS, formatUSD, type FlightDTO } from '../shared';
import { cx } from '../common/ui';
import { AirlineBadge, FlightDateLine, FlightTimeline } from './FlightBits';

interface Props {
  flight: FlightDTO;
  seatsNeeded: number;
  onSelect: (flight: FlightDTO) => void;
}

function unavailableText(f: FlightDTO, seatsNeeded: number): string | null {
  switch (f.unavailableReason) {
    case 'SOLD_OUT':
      return 'Sold out';
    case 'INSUFFICIENT_SEATS':
      return `Only ${f.availableSeats} seat${f.availableSeats === 1 ? '' : 's'} left - ${seatsNeeded} needed`;
    case 'DEPARTS_BEFORE_OUTBOUND_ARRIVAL':
      return 'Departs before your outbound flight lands';
    case 'DEPARTED':
      return 'Already departed';
    default:
      return null;
  }
}

function SeatsInfo({ flight }: { flight: FlightDTO }) {
  const low = flight.availableSeats > 0 && flight.availableSeats <= 4;
  return (
    <p className={cx('flex items-center gap-1 text-xs', low ? 'font-semibold text-amber-700' : 'text-ink-muted')}>
      <Armchair className="h-3.5 w-3.5" aria-hidden="true" />
      {flight.availableSeats === 0
        ? 'No seats available'
        : low
          ? `Only ${flight.availableSeats} seat${flight.availableSeats === 1 ? '' : 's'} left`
          : `${flight.availableSeats} seats available`}
    </p>
  );
}

function SelectButton({ flight, seatsNeeded, onSelect, className }: Props & { className?: string }) {
  const reason = unavailableText(flight, seatsNeeded);
  return (
    <div className={className}>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!flight.bookable}
        onClick={() => onSelect(flight)}
        aria-label={`Select flight ${flight.flightNumber} for ${formatUSD(flight.price)}`}
      >
        {flight.bookable ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Select flight
          </>
        ) : (
          'Not available'
        )}
      </button>
      {reason && <p className="mt-1.5 text-center text-xs font-medium text-red-600">{reason}</p>}
    </div>
  );
}

export function FlightCard(props: Props) {
  const { flight } = props;
  return (
    <article className="card overflow-hidden transition hover:shadow-lift" aria-label={`${flight.airline.name} ${flight.flightNumber}`}>
      <div className="flex items-stretch gap-4 p-3 sm:p-5">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1.5 text-center sm:w-28">
          <AirlineBadge code={flight.airline.code} />
          <p className="text-[11px] font-semibold leading-tight text-ink-soft">{flight.flightNumber}</p>
          <p className="hidden text-[11px] leading-tight text-ink-muted sm:block">{flight.airline.name}</p>
        </div>
        <div className="flex min-w-[170px] flex-1 flex-col justify-center gap-2">
          <FlightTimeline flight={flight} compact />
          <FlightDateLine flight={flight} />
          <SeatsInfo flight={flight} />
        </div>
        <div className="flex w-36 shrink-0 flex-col justify-center gap-2 border-l border-slate-100 pl-4 sm:w-44">
          <div>
            <p className="font-display text-2xl font-bold">{formatUSD(flight.price)}</p>
            <p className="text-xs text-ink-muted">per passenger · {CABIN_LABELS[flight.cabin]}</p>
          </div>
          <SelectButton {...props} />
        </div>
      </div>
    </article>
  );
}

export function FlightCardSkeleton() {
  return (
    <div className="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
      <div className="flex items-center gap-3 md:w-44">
        <div className="h-10 w-10 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-3 w-16 rounded bg-slate-100" />
        </div>
      </div>
      <div className="flex flex-1 items-center gap-4">
        <div className="h-8 w-14 rounded bg-slate-200" />
        <div className="h-px flex-1 bg-slate-200" />
        <div className="h-8 w-14 rounded bg-slate-200" />
      </div>
      <div className="space-y-2 md:w-52">
        <div className="h-7 w-24 rounded bg-slate-200" />
        <div className="h-10 w-full rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
