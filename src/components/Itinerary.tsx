import { ArrowRight, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import {
  CABIN_LABELS,
  PASSENGER_TYPE_LABELS,
  countryName,
  formatUSD,
  formatUsDate,
  type Cabin,
  type Direction,
  type FlightCoreDTO,
  type PassengerDTO,
  type PricingDTO,
} from '../shared';
import { cx } from '../common/ui';
import { AirlineBadge, FlightDateLine, FlightTimeline } from './FlightBits';

export function ItineraryFlight({ direction, flight, cabin, price }: { direction: Direction; flight: FlightCoreDTO; cabin: Cabin; price?: number }) {
  const Icon = direction === 'OUTBOUND' ? PlaneTakeoff : PlaneLanding;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
          <Icon className="h-4 w-4" /> {direction === 'OUTBOUND' ? 'Outbound' : 'Return'}
        </p>
        <p className="text-xs text-ink-muted">
          {flight.airline.name} · {flight.flightNumber} · {CABIN_LABELS[cabin]}
          {price !== undefined && <> · {formatUSD(price)} per adult</>}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <AirlineBadge code={flight.airline.code} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <FlightTimeline flight={flight} compact />
          <FlightDateLine flight={flight} />
        </div>
      </div>
    </div>
  );
}

export function RouteTitle({ flight, roundTrip }: { flight: FlightCoreDTO; roundTrip: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {flight.origin.city}
      {roundTrip ? <span aria-label="round trip">⇄</span> : <ArrowRight className="h-4 w-4" aria-label="to" />}
      {flight.destination.city}
    </span>
  );
}

export function PassengerTable({ passengers }: { passengers: PassengerDTO[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-muted">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Name</th>
            <th className="py-2 pr-3 font-semibold">Type</th>
            <th className="py-2 pr-3 font-semibold">Date of birth</th>
            <th className="py-2 pr-3 font-semibold">Nationality</th>
            <th className="py-2 font-semibold">Passport</th>
          </tr>
        </thead>
        <tbody>
          {passengers.map((p) => (
            <tr key={p.position} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-3 text-ink-muted">{p.position}</td>
              <td className="py-2.5 pr-3 font-medium">
                {p.firstName} {p.lastName}
                {p.email && <span className="block text-xs font-normal text-ink-muted">{p.email}</span>}
              </td>
              <td className="py-2.5 pr-3">{PASSENGER_TYPE_LABELS[p.type]}</td>
              <td className="py-2.5 pr-3 tabular-nums">{formatUsDate(p.dateOfBirth)}</td>
              <td className="py-2.5 pr-3">{countryName(p.nationality)}</td>
              <td className="py-2.5 font-mono text-xs">{p.passportNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PriceBreakdown({ pricing, className }: { pricing: PricingDTO; className?: string }) {
  const directions = [...new Set(pricing.lines.map((l) => l.direction))];
  return (
    <div className={cx('text-sm', className)}>
      {directions.map((dir) => {
        const lines = pricing.lines.filter((l) => l.direction === dir);
        return (
          <div key={dir} className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {dir === 'OUTBOUND' ? 'Outbound' : 'Return'} · {lines[0]?.flightNumber}
            </p>
            {lines.map((l) => (
              <div key={l.passengerType} className="flex justify-between gap-3 py-0.5">
                <span className="text-ink-soft">
                  {l.count} × {PASSENGER_TYPE_LABELS[l.passengerType]}
                  <span className="text-ink-muted">
                    {' '}
                    @ {formatUSD(l.unitFare)}
                  </span>
                </span>
                <span className="tabular-nums">{formatUSD(l.amount)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="space-y-1.5 border-t border-slate-200 pt-3">
        <div className="flex justify-between">
          <span className="text-ink-soft">Base fare</span>
          <span className="tabular-nums">{formatUSD(pricing.baseFare)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Taxes ({pricing.taxRatePercent}%)</span>
          <span className="tabular-nums">{formatUSD(pricing.taxes)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Service fee</span>
          <span className="tabular-nums">{formatUSD(pricing.serviceFee)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
        <span className="text-base font-semibold">Total</span>
        <span className="font-display text-2xl font-bold text-ink">{formatUSD(pricing.total)}</span>
      </div>
      <p className="mt-1 text-right text-xs text-ink-muted">All prices in {pricing.currency}</p>
    </div>
  );
}

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1 text-sm" aria-label="Booking progress">
      {steps.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
              i < current && 'bg-emerald-500 text-white',
              i === current && 'bg-gradient-to-br from-brand-600 to-accent-600 text-white',
              i > current && 'bg-slate-200 text-ink-muted',
            )}
            aria-current={i === current ? 'step' : undefined}
          >
            {i + 1}
          </span>
          <span className={cx('font-medium', i === current ? 'text-ink' : 'text-ink-muted')}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300 sm:w-10" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
