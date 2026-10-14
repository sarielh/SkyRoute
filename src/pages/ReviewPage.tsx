import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, RefreshCw } from 'lucide-react';
import { passengerTypeSequence, type PassengerDTO, type PricingDTO } from '../shared';
import { HttpError } from '../common/http';
import { useToast } from '../common/toast';
import { Alert, FieldError, Skeleton, Spinner } from '../common/ui';
import { api } from '../api';
import { useBookingFlow } from '../context/BookingFlowContext';
import { FlowExpired } from '../components/FlowGuard';
import { ItineraryFlight, PassengerTable, PriceBreakdown, StepIndicator } from '../components/Itinerary';
import { isComplete, toPassengerInput, uuid } from '../lib/passengers';
import { countsOf, searchUrl } from '../lib/search';
import { BOOKING_STEPS } from './ResultsPage';

export function ReviewPage() {
  const flow = useBookingFlow();
  const { criteria, outbound, returnFlight, passengers } = flow;
  const ready = !!criteria && !!outbound && (criteria.tripType === 'ONE_WAY' || !!returnFlight);
  if (!ready) return <FlowExpired />;
  if (!isComplete(passengers, passengerTypeSequence(countsOf(criteria)))) return <Navigate to="/booking/passengers" replace />;
  return <Review />;
}

function Review() {
  const navigate = useNavigate();
  const toast = useToast();
  const flow = useBookingFlow();
  const criteria = flow.criteria!;
  const outbound = flow.outbound!;
  const returnFlight = criteria.tripType === 'ROUND_TRIP' ? flow.returnFlight : null;
  const drafts = flow.passengers!;

  const [pricing, setPricing] = useState<PricingDTO | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<HttpError | null>(null);
  const completed = useRef(false);

  // One idempotency key per review of this exact itinerary and passenger list.
  const [idempotencyKey] = useState(() => flow.idempotencyKey ?? uuid());
  useEffect(() => {
    flow.setIdempotencyKey(idempotencyKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idempotencyKey]);

  const passengerInputs = useMemo(() => drafts.map((p, i) => toPassengerInput(p, i === 0)), [drafts]);
  const passengerRows: PassengerDTO[] = passengerInputs.map((p, i) => ({ ...p, position: i + 1, email: p.email ?? null }));

  const loadQuote = useCallback(() => {
    setQuoteError(null);
    setPricing(null);
    api
      .quote({
        tripType: criteria.tripType,
        outboundFlightId: outbound.id,
        returnFlightId: returnFlight?.id ?? null,
        cabin: criteria.cabin,
        passengers: countsOf(criteria),
      })
      .then((r) => setPricing(r.pricing))
      .catch((err) => setQuoteError(err instanceof Error ? err.message : 'Could not calculate the price.'));
  }, [criteria, outbound.id, returnFlight?.id]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const confirm = () => {
    if (!accepted) {
      setTermsError('Please confirm the passenger details and accept the fare rules.');
      return;
    }
    setSubmitting(true);
    setBookingError(null);
    api
      .createBooking(
        {
          tripType: criteria.tripType,
          outboundFlightId: outbound.id,
          returnFlightId: returnFlight?.id ?? null,
          cabin: criteria.cabin,
          passengers: passengerInputs,
        },
        idempotencyKey,
      )
      .then(({ booking }) => {
        if (completed.current) return;
        completed.current = true;
        flow.reset();
        toast.success('Booking confirmed', `Your booking reference is ${booking.reference}.`);
        navigate(`/booking/confirmation/${booking.reference}`, { replace: true, state: { booking } });
      })
      .catch((err) => {
        if (completed.current) return;
        setSubmitting(false);
        setBookingError(err instanceof HttpError ? err : new HttpError(0, 'UNKNOWN', 'Something went wrong.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  };

  const backToFlights = searchUrl(criteria, criteria.tripType === 'ROUND_TRIP' ? { leg: 'return' } : {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <StepIndicator steps={BOOKING_STEPS} current={2} />
      <h1 className="mt-5 text-2xl font-bold">Booking summary</h1>
      <p className="mt-1 text-sm text-ink-muted">Review your trip before confirming. No payment is taken - this is a simulated booking.</p>

      {bookingError && (
        <Alert
          tone="error"
          className="mt-5"
          title={bookingError.status === 409 ? 'This booking could not be completed' : 'Booking failed'}
          action={
            bookingError.status === 409 ? (
              <button type="button" className="btn-secondary" onClick={() => navigate(backToFlights)}>
                Choose another flight
              </button>
            ) : undefined
          }
        >
          {bookingError.details.length > 0 && bookingError.status === 400 ? (
            <ul className="list-disc pl-5">
              {bookingError.details.map((d) => (
                <li key={d.field}>{d.message}</li>
              ))}
            </ul>
          ) : (
            bookingError.message
          )}
        </Alert>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="flights-h">
            <h2 id="flights-h" className="mb-4 text-lg font-semibold">
              Flights
            </h2>
            <div className="space-y-3">
              <ItineraryFlight direction="OUTBOUND" flight={outbound} cabin={criteria.cabin} price={outbound.price} />
              {returnFlight && <ItineraryFlight direction="RETURN" flight={returnFlight} cabin={criteria.cabin} price={returnFlight.price} />}
            </div>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="pax-h">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="pax-h" className="text-lg font-semibold">
                Passengers
              </h2>
              <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => navigate('/booking/passengers')}>
                Edit
              </button>
            </div>
            <PassengerTable passengers={passengerRows} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="card p-5 sm:p-6" aria-labelledby="price-h">
            <h2 id="price-h" className="mb-4 text-lg font-semibold">
              Price details
            </h2>
            {!pricing && !quoteError && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
            {quoteError && (
              <Alert
                tone="error"
                title="Price unavailable"
                action={
                  <button type="button" className="btn-secondary" onClick={loadQuote}>
                    <RefreshCw className="h-4 w-4" /> Retry
                  </button>
                }
              >
                {quoteError}
              </Alert>
            )}
            {pricing && <PriceBreakdown pricing={pricing} />}

            <div className="mt-5 border-t border-slate-200 pt-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked);
                    setTermsError(null);
                  }}
                  aria-describedby={termsError ? 'terms-error' : undefined}
                />
                <span className="text-ink-soft">I confirm that the passenger details are correct and I accept the fare rules and cancellation policy.</span>
              </label>
              <FieldError id="terms-error" message={termsError} />

              <button type="button" className="btn-primary mt-4 w-full py-3 text-base" onClick={confirm} aria-busy={submitting}>
                {submitting ? <Spinner className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                {submitting ? 'Confirming…' : 'Confirm Booking'}
              </button>
              <button type="button" className="btn-ghost mt-2 w-full" onClick={() => navigate('/booking/passengers')}>
                <ArrowLeft className="h-4 w-4" /> Back to passenger details
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
