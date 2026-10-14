import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Ticket } from 'lucide-react';
import { formatUSD, type BookingDTO } from '../shared';
import { HttpError, isAbort } from '../common/http';
import { Alert, cx, EmptyState, Skeleton } from '../common/ui';
import { api } from '../api';
import { StatusBadge } from '../components/BookingView';
import { formatDateWithWeekday, formatTime, plural } from '../lib/format';

type StatusFilter = '' | 'CONFIRMED' | 'CANCELLED';

export function MyBookingsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);
  const [error, setError] = useState<HttpError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setError(null);
      api
        .listBookings({ reference: query.trim() || undefined, status: status || undefined }, ctrl.signal)
        .then((r) => setBookings(r.bookings))
        .catch((err) => {
          if (!isAbort(err)) setError(err instanceof HttpError ? err : new HttpError(0, 'UNKNOWN', 'Something went wrong.'));
        });
    }, query ? 250 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, status, nonce]);

  const filtering = query.trim() !== '' || status !== '';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="mt-1 text-sm text-ink-muted">View, search and manage your trips.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <label htmlFor="booking-search" className="sr-only">
            Search by booking reference
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="booking-search"
            className="input pl-10 uppercase placeholder:normal-case"
            placeholder="Search by booking reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={12}
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Booking status">
        {(
          [
            ['', 'All'],
            ['CONFIRMED', 'Confirmed'],
            ['CANCELLED', 'Cancelled'],
          ] as [StatusFilter, string][]
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={cx('chip', status === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-ink-soft hover:border-slate-300')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {error && (
          <Alert
            tone="error"
            title="Could not load bookings"
            action={
              <button type="button" className="btn-secondary" onClick={() => setNonce((n) => n + 1)}>
                Try again
              </button>
            }
          >
            {error.message}
          </Alert>
        )}

        {!error && bookings === null && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {!error && bookings?.length === 0 && (
          <EmptyState
            icon={<Ticket className="h-7 w-7" />}
            title={filtering ? 'No matching bookings' : 'No bookings yet'}
            description={filtering ? 'No bookings match your search. Check the reference and try again.' : 'When you book a flight it will appear here.'}
            action={
              !filtering && (
                <Link to="/" className="btn-primary">
                  Search flights
                </Link>
              )
            }
          />
        )}

        {!error && bookings && bookings.length > 0 && (
          <>
            <p className="mb-3 text-sm text-ink-muted">{plural(bookings.length, 'booking')}</p>
            <ul className="space-y-3">
              {bookings.map((b) => {
                const out = b.flights[0]?.flight;
                return (
                  <li key={b.reference}>
                    <Link
                      to={`/bookings/${b.reference}`}
                      className={cx('card flex flex-col gap-4 p-5 transition hover:shadow-lift sm:flex-row sm:items-center', b.status === 'CANCELLED' && 'opacity-80')}
                    >
                      <div className="sm:w-36">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Reference</p>
                        <p className="font-mono text-lg font-bold tracking-wider">{b.reference}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {out && (
                          <>
                            <p className="font-semibold">
                              {out.origin.city} {b.tripType === 'ROUND_TRIP' ? '⇄' : '→'} {out.destination.city}
                            </p>
                            <p className="mt-0.5 text-sm text-ink-muted">
                              {formatDateWithWeekday(out.departureTime)} · {formatTime(out.departureTime)} · {out.flightNumber}
                              {b.flights[1] && <> · Return {formatDateWithWeekday(b.flights[1].flight.departureTime)}</>}
                            </p>
                          </>
                        )}
                        <p className="mt-1 text-sm text-ink-muted">
                          {plural(b.passengers.length, 'passenger')} · {b.tripType === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <p className="font-display text-xl font-bold">{formatUSD(b.pricing.total)}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                          View details <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
