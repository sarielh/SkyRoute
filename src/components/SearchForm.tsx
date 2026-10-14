import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, PlaneLanding, PlaneTakeoff, Search } from 'lucide-react';
import { formatUsDate, localTodayIso, parseUsDate, type AirportDTO, type Cabin, type PassengerCounts, type TripType } from '../shared';
import { detailsToFields, HttpError } from '../common/http';
import { useToast } from '../common/toast';
import { cx, Field, FieldError, Spinner } from '../common/ui';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { useBookingFlow } from '../context/BookingFlowContext';
import { criteriaToQuery, searchUrl, type SearchCriteria } from '../lib/search';
import { useAirportMap } from '../lib/useAirports';
import { AirportInput } from './AirportInput';
import { DateField } from './DateField';
import { PassengerPicker } from './PassengerPicker';

interface Props {
  initial?: SearchCriteria | null;
  variant?: 'hero' | 'compact';
  /** Destination chosen elsewhere on the page (e.g. a popular destination card) */
  presetDestination?: { code: string; nonce: number } | null;
}

type Errors = Record<string, string>;

export function SearchForm({ initial, variant = 'hero', presetDestination }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { config } = useApp();
  const flow = useBookingFlow();
  const airports = useAirportMap();

  const [tripType, setTripType] = useState<TripType>(initial?.tripType ?? 'ROUND_TRIP');
  const [origin, setOrigin] = useState<AirportDTO | null>(null);
  const [destination, setDestination] = useState<AirportDTO | null>(null);
  const [departure, setDeparture] = useState(initial?.departureDate ? formatUsDate(initial.departureDate) : '');
  const [returnDate, setReturnDate] = useState(initial?.returnDate ? formatUsDate(initial.returnDate) : '');
  const [counts, setCounts] = useState<PassengerCounts>({
    adults: initial?.adults ?? 1,
    children: initial?.children ?? 0,
    infants: initial?.infants ?? 0,
  });
  const [cabin, setCabin] = useState<Cabin>(initial?.cabin ?? 'ECONOMY');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  // Resolve initial airport codes once the airport list is available.
  useEffect(() => {
    if (!initial || airports.size === 0) return;
    if (!origin && initial.origin) setOrigin(airports.get(initial.origin) ?? null);
    if (!destination && initial.destination) setDestination(airports.get(initial.destination) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports, initial]);

  useEffect(() => {
    if (presetDestination && airports.size) {
      setDestination(airports.get(presetDestination.code) ?? null);
      if (!origin) setOrigin(airports.get('TLV') ?? null);
      setErrors((e) => ({ ...e, destination: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetDestination, airports]);

  const clearError = (field: string) => setErrors((e) => (e[field] ? { ...e, [field]: '' } : e));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const local: Errors = {};
    const depIso = departure.trim() ? parseUsDate(departure) : '';
    const retIso = tripType === 'ROUND_TRIP' && returnDate.trim() ? parseUsDate(returnDate) : '';
    if (depIso === null) local.departureDate = 'Please enter a valid date (MM/DD/YYYY).';
    if (retIso === null) local.returnDate = 'Please enter a valid date (MM/DD/YYYY).';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    const criteria: SearchCriteria = {
      tripType,
      origin: origin?.code ?? '',
      destination: destination?.code ?? '',
      departureDate: depIso ?? '',
      returnDate: tripType === 'ROUND_TRIP' ? retIso ?? '' : null,
      ...counts,
      cabin,
    };

    setSubmitting(true);
    setErrors({});
    try {
      const query = { ...criteriaToQuery(criteria), leg: 'outbound' };
      const data = await api.searchFlights(query);
      flow.startSearch(criteria);
      navigate(searchUrl(criteria), { state: { prefetched: { key: new URLSearchParams(criteriaToQuery(criteria)).toString(), data } } });
    } catch (err) {
      if (err instanceof HttpError && err.status === 400 && err.details.length) {
        const fields = detailsToFields(err.details);
        const mapped: Errors = {};
        for (const [field, message] of Object.entries(fields)) {
          const key = ['adults', 'children', 'infants', 'passengers'].includes(field) ? 'passengers' : field;
          if (!mapped[key]) mapped[key] = message;
        }
        setErrors(mapped);
      } else {
        toast.error('Search failed', err instanceof Error ? err.message : undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const today = localTodayIso();
  const depIso = parseUsDate(departure);
  const hero = variant === 'hero';

  return (
    <form onSubmit={onSubmit} noValidate className={cx(hero ? 'card p-4 sm:p-6' : '')} aria-label="Search flights">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Trip type" className="inline-flex rounded-xl bg-slate-100 p-1">
          {(['ROUND_TRIP', 'ONE_WAY'] as TripType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tripType === t}
              onClick={() => {
                setTripType(t);
                clearError('returnDate');
              }}
              className={cx(
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                tripType === t ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${variant}-cabin`} className="text-sm font-medium text-ink-muted">
            Cabin
          </label>
          <select
            id={`${variant}-cabin`}
            value={cabin}
            onChange={(e) => setCabin(e.target.value as Cabin)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          >
            <option value="ECONOMY">Economy</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-6">
          <Field label="From" htmlFor={`${variant}-origin`} error={errors.origin}>
            <AirportInput
              id={`${variant}-origin`}
              value={origin}
              onChange={(a) => {
                setOrigin(a);
                clearError('origin');
              }}
              placeholder="City or airport"
              invalid={!!errors.origin}
              describedBy={errors.origin ? `${variant}-origin-error` : undefined}
              icon={<PlaneTakeoff className="h-5 w-5" />}
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              setOrigin(destination);
              setDestination(origin);
            }}
            className="absolute left-1/2 top-[38px] z-10 hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-ink-soft shadow-sm transition hover:border-brand-500 hover:text-brand-600 sm:flex"
            aria-label="Swap origin and destination"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <Field label="To" htmlFor={`${variant}-destination`} error={errors.destination}>
            <AirportInput
              id={`${variant}-destination`}
              value={destination}
              onChange={(a) => {
                setDestination(a);
                clearError('destination');
              }}
              placeholder="City or airport"
              invalid={!!errors.destination}
              describedBy={errors.destination ? `${variant}-destination-error` : undefined}
              icon={<PlaneLanding className="h-5 w-5" />}
            />
          </Field>
        </div>

        <div className={cx('grid gap-3', tripType === 'ROUND_TRIP' ? 'grid-cols-1 min-[400px]:grid-cols-2' : 'grid-cols-1', 'lg:col-span-4')}>
          <Field label="Departure" htmlFor={`${variant}-departure`} error={errors.departureDate}>
            <DateField
              id={`${variant}-departure`}
              value={departure}
              onChange={(v) => {
                setDeparture(v);
                clearError('departureDate');
              }}
              minDate={today}
              invalid={!!errors.departureDate}
              describedBy={errors.departureDate ? `${variant}-departure-error` : undefined}
            />
          </Field>
          {tripType === 'ROUND_TRIP' && (
            <Field label="Return" htmlFor={`${variant}-return`} error={errors.returnDate}>
              <DateField
                id={`${variant}-return`}
                value={returnDate}
                onChange={(v) => {
                  setReturnDate(v);
                  clearError('returnDate');
                }}
                minDate={depIso ?? today}
                openTo={depIso ?? undefined}
                invalid={!!errors.returnDate}
                describedBy={errors.returnDate ? `${variant}-return-error` : undefined}
              />
            </Field>
          )}
        </div>

        <div className="lg:col-span-2">
          <Field label="Passengers" htmlFor={`${variant}-passengers`}>
            <PassengerPicker
              id={`${variant}-passengers`}
              value={counts}
              onChange={(v) => {
                setCounts(v);
                clearError('passengers');
              }}
              max={config.search.maxPassengers}
              invalid={!!errors.passengers}
              describedBy={errors.passengers ? `${variant}-passengers-error` : undefined}
            />
          </Field>
          <FieldError id={`${variant}-passengers-error`} message={errors.passengers} />
        </div>
      </div>

      {(errors.cabin || errors.tripType) && <FieldError message={errors.cabin || errors.tripType} />}

      <div className="mt-5 flex justify-end">
        <button type="submit" className="btn-primary w-full px-8 py-3 text-base sm:w-auto" disabled={submitting}>
          {submitting ? <Spinner className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          {submitting ? 'Searching…' : 'Search flights'}
        </button>
      </div>
    </form>
  );
}
