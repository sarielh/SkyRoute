import { Plane } from 'lucide-react';
import { formatDuration, type FlightCoreDTO } from '../shared';
import { cx } from '../common/ui';
import { arrivalDayOffset, formatDateWithWeekday, formatTime } from '../lib/format';

const AIRLINE_COLORS: Record<string, string> = {
  A7: 'from-sky-500 to-brand-600',
  M3: 'from-teal-500 to-cyan-600',
  C9: 'from-emerald-500 to-green-700',
  P8: 'from-indigo-500 to-accent-700',
  B5: 'from-blue-400 to-sky-600',
  N4: 'from-fuchsia-500 to-accent-600',
};

export function AirlineBadge({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold tracking-wide text-white shadow-sm',
        AIRLINE_COLORS[code] ?? 'from-slate-400 to-slate-600',
        className,
      )}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}

export function StopsLabel({ flight }: { flight: FlightCoreDTO }) {
  if (flight.stops === 0) return <span className="font-medium text-emerald-700">Nonstop</span>;
  return (
    <span className="font-medium text-amber-700">
      1 stop
      {flight.layover && (
        <span className="font-normal text-ink-muted">
          {' '}
          · {flight.layover.airport.code} ({formatDuration(flight.layover.durationMinutes)})
        </span>
      )}
    </span>
  );
}

/** Departure -> arrival timeline used in cards and summaries. */
export function FlightTimeline({ flight, compact }: { flight: FlightCoreDTO; compact?: boolean }) {
  const dayOffset = arrivalDayOffset(flight.departureTime, flight.arrivalTime);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
      <div className="text-left">
        <p className={cx('font-display font-bold tabular-nums', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>{formatTime(flight.departureTime)}</p>
        <p className="text-sm font-semibold text-ink-soft">{flight.origin.code}</p>
      </div>
      <div className="flex min-w-[64px] flex-1 flex-col items-center text-xs text-ink-muted">
        <span>{formatDuration(flight.durationMinutes)}</span>
        <span className="relative my-1 flex w-full items-center">
          <span className="h-px flex-1 bg-slate-300" />
          {flight.stops > 0 && <span className="mx-1 h-2 w-2 rounded-full border-2 border-amber-500 bg-white" />}
          {flight.stops > 0 && <span className="h-px flex-1 bg-slate-300" />}
          <Plane className="ml-1 h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
        </span>
        <span className="text-center">
          <StopsLabel flight={flight} />
        </span>
      </div>
      <div className="text-right">
        <p className={cx('font-display font-bold tabular-nums', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>
          {formatTime(flight.arrivalTime)}
          {dayOffset > 0 && (
            <sup className="ml-0.5 text-xs font-semibold text-accent-600" title="Arrives on a later day">
              +{dayOffset}
            </sup>
          )}
        </p>
        <p className="text-sm font-semibold text-ink-soft">{flight.destination.code}</p>
      </div>
    </div>
  );
}

export function FlightDateLine({ flight }: { flight: FlightCoreDTO }) {
  return (
    <p className="text-xs text-ink-muted">
      {formatDateWithWeekday(flight.departureTime)} · {flight.origin.city} → {flight.destination.city}
    </p>
  );
}
