import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Copy, Printer, SearchX, Ticket } from 'lucide-react';
import { formatUSD, type BookingDTO } from '../shared';
import { HttpError } from '../common/http';
import { useToast } from '../common/toast';
import { Alert, EmptyState, Skeleton } from '../common/ui';
import { api } from '../api';
import { BookingSections, StatusBadge } from '../components/BookingView';
import { StepIndicator } from '../components/Itinerary';
import { BOOKING_STEPS } from './ResultsPage';

export function ConfirmationPage() {
  const { reference = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const fromState = (location.state as { booking?: BookingDTO } | null)?.booking;
  const initial = fromState && fromState.reference === reference ? fromState : null;
  const [booking, setBooking] = useState<BookingDTO | null>(initial);
  const [error, setError] = useState<HttpError | null>(null);

  useEffect(() => {
    // Booking data passed from the booking step is only used for the first render;
    // a refresh always loads the booking from the server.
    if (initial) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (booking && booking.reference === reference) return;
    let alive = true;
    setError(null);
    api
      .getBooking(reference)
      .then((r) => alive && setBooking(r.booking))
      .catch((err) => alive && setError(err instanceof HttpError ? err : new HttpError(0, 'UNKNOWN', 'Something went wrong.')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {error.status === 404 ? (
          <EmptyState
            icon={<SearchX className="h-7 w-7" />}
            title="Booking not found"
            description={`We couldn't find a booking with reference ${reference.toUpperCase()}.`}
            action={
              <Link to="/bookings" className="btn-primary">
                Go to My Bookings
              </Link>
            }
          />
        ) : (
          <Alert tone="error" title="Could not load your booking">
            {error.message}
          </Alert>
        )}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const copy = () => {
    navigator.clipboard?.writeText(booking.reference).then(
      () => toast.info('Booking reference copied'),
      () => undefined,
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="print:hidden">
        <StepIndicator steps={BOOKING_STEPS} current={3} />
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-brand-600 to-accent-700 p-6 text-white shadow-lift sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-10 w-10 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{booking.status === 'CONFIRMED' ? 'Your booking is confirmed!' : 'Booking cancelled'}</h1>
              <p className="mt-1 text-white/85">
                A confirmation has been sent to <span className="font-semibold">{booking.contactEmail}</span>.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-5 py-4 ring-1 ring-inset ring-white/25">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Booking reference</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-3xl font-bold tracking-widest" data-testid="booking-reference">
                {booking.reference}
              </p>
              <button type="button" onClick={copy} className="rounded-lg p-1.5 hover:bg-white/15 print:hidden" aria-label="Copy booking reference">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-white/85">Total paid: {formatUSD(booking.pricing.total)}</p>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <StatusBadge status={booking.status} />
        <span>
          {booking.tripType === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'} · {booking.passengers.length} passenger{booking.passengers.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-5">
        <BookingSections booking={booking} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
        <Link to={`/bookings/${booking.reference}`} className="btn-primary">
          <Ticket className="h-4 w-4" /> Manage booking
        </Link>
        <Link to="/" className="btn-secondary">
          Book another flight
        </Link>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
    </div>
  );
}
