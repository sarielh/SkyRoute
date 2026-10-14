import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Info, SearchX } from 'lucide-react';
import type { BookingDTO } from '../shared';
import { HttpError } from '../common/http';
import { useToast } from '../common/toast';
import { Alert, EmptyState, Modal, Skeleton, Spinner } from '../common/ui';
import { api } from '../api';
import { BookingSections, StatusBadge } from '../components/BookingView';
import { formatInZone, formatLocalDateTime } from '../lib/format';

export function BookingDetailsPage() {
  const { reference = '' } = useParams();
  const toast = useToast();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [error, setError] = useState<HttpError | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api
      .getBooking(reference)
      .then((r) => setBooking(r.booking))
      .catch((err) => setError(err instanceof HttpError ? err : new HttpError(0, 'UNKNOWN', 'Something went wrong.')));
  }, [reference]);

  useEffect(() => {
    setBooking(null);
    load();
  }, [load]);

  const cancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      const res = await api.cancelBooking(booking.reference);
      setBooking(res.booking);
      toast.success('Booking cancelled', `Booking ${res.booking.reference} has been cancelled.`);
    } catch (err) {
      toast.error('Cancellation failed', err instanceof Error ? err.message : undefined);
      load();
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

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
                Back to My Bookings
              </Link>
            }
          />
        ) : (
          <Alert tone="error" title="Could not load booking">
            {error.message}
          </Alert>
        )}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const first = booking.flights[0].flight;
  const deadline = formatInZone(booking.cancellationDeadline, first.origin.timezone);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/bookings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> My Bookings
      </Link>

      <div className="card mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Booking reference</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-wider">{booking.reference}</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Booked {formatLocalDateTime(booking.createdAt)}
            {booking.cancelledAt && <> · Cancelled {formatLocalDateTime(booking.cancelledAt)}</>}
          </p>
        </div>
        {booking.status === 'CONFIRMED' && booking.cancellable && (
          <button type="button" className="btn-secondary border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50" onClick={() => setConfirmOpen(true)}>
            <Ban className="h-4 w-4" /> Cancel booking
          </button>
        )}
      </div>

      {booking.status === 'CONFIRMED' && (
        <div className="mt-4">
          {booking.cancellable ? (
            <Alert tone="info">
              Free cancellation until <span className="font-semibold">{deadline}</span> ({first.origin.city} local time), 24 hours before departure.
            </Alert>
          ) : (
            <Alert tone="warning" title="Cancellation not available">
              Bookings can be cancelled online until 24 hours before departure. The cancellation deadline for this booking was {deadline} ({first.origin.city} local time).
            </Alert>
          )}
        </div>
      )}
      {booking.status === 'CANCELLED' && (
        <div className="mt-4">
          <Alert tone="warning" title="This booking has been cancelled">
            The seats have been released. This booking can no longer be used for travel.
          </Alert>
        </div>
      )}

      <div className="mt-5">
        <BookingSections booking={booking} />
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-muted">
        <Info className="h-3.5 w-3.5" /> Contact email: {booking.contactEmail}
      </p>

      <Modal
        open={confirmOpen}
        title={`Cancel booking ${booking.reference}?`}
        onClose={() => !cancelling && setConfirmOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
              Keep booking
            </button>
            <button type="button" className="btn-danger" onClick={cancel} disabled={cancelling}>
              {cancelling && <Spinner />} Yes, cancel booking
            </button>
          </>
        }
      >
        This will cancel the booking for all {booking.passengers.length} passenger{booking.passengers.length === 1 ? '' : 's'} and release the seats. This action cannot be undone.
      </Modal>
    </div>
  );
}
