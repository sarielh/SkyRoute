import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Pencil, PlaneTakeoff, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { CABIN_LABELS, SORT_LABELS, SORT_OPTIONS, seatsRequired, type FlightDTO, type SearchResponse, type SortOption } from '../shared';
import { HttpError, isAbort } from '../common/http';
import { Alert, cx, EmptyState } from '../common/ui';
import { api } from '../api';
import { useBookingFlow } from '../context/BookingFlowContext';
import { FiltersPanel } from '../components/FiltersPanel';
import { FlightCard, FlightCardSkeleton } from '../components/FlightCard';
import { ItineraryFlight, StepIndicator } from '../components/Itinerary';
import { SearchForm } from '../components/SearchForm';
import { formatDateWithWeekday, passengersSummary, plural } from '../lib/format';
import {
  countsOf,
  criteriaToQuery,
  filtersToQuery,
  hasActiveFilters,
  readCriteria,
  readFilters,
  readLeg,
  type ResultFilters,
} from '../lib/search';
import { useAirportMap } from '../lib/useAirports';

export const BOOKING_STEPS = ['Select flights', 'Passenger details', 'Summary', 'Confirmation'];

export function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const flow = useBookingFlow();
  const airports = useAirportMap();

  const criteria = useMemo(() => readCriteria(params), [params]);
  const criteriaKey = new URLSearchParams(criteriaToQuery(criteria)).toString();
  const leg = readLeg(params);
  const filters = useMemo(() => readFilters(params), [params]);
  const isRoundTrip = criteria.tripType === 'ROUND_TRIP';
  const outbound = flow.outbound;

  const prefetched = useRef<{ key: string; data: SearchResponse } | null>(
    (location.state as { prefetched?: { key: string; data: SearchResponse } } | null)?.prefetched ?? null,
  );
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<HttpError | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  // The URL is the source of truth for the search context (refresh / back / forward safe).
  useEffect(() => {
    flow.startSearch(criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaKey]);

  // The return leg needs a selected outbound flight.
  useEffect(() => {
    if (leg === 'return' && !outbound) {
      const next = new URLSearchParams(params);
      next.delete('leg');
      setParams(next, { replace: true });
    }
  }, [leg, outbound, params, setParams]);

  const outboundId = leg === 'return' ? outbound?.id : undefined;
  const queryKey = JSON.stringify({ c: criteriaKey, leg, f: filtersToQuery(filters), outboundId, reloadNonce });

  useEffect(() => {
    if (leg === 'return' && !outbound) return;
    const pre = prefetched.current;
    prefetched.current = null;
    if (pre && pre.key === criteriaKey && leg === 'outbound' && !hasActiveFilters(filters) && filters.sort === 'price_asc') {
      setData(pre.data);
      setError(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .searchFlights({ ...criteriaToQuery(criteria), leg, ...filtersToQuery(filters), outboundFlightId: outboundId }, ctrl.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setError(err instanceof HttpError ? err : new HttpError(0, 'UNKNOWN', 'Something went wrong.'));
        setData(null);
        setLoading(false);
        if (err instanceof HttpError && err.status === 400) setEditing(true);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const updateFilters = (f: ResultFilters) => {
    const next = new URLSearchParams(criteriaToQuery(criteria));
    if (leg === 'return') next.set('leg', 'return');
    for (const [k, v] of Object.entries(filtersToQuery(f))) next.set(k, v);
    setParams(next, { replace: true });
  };

  const onSelect = (flight: FlightDTO) => {
    if (leg === 'outbound') {
      flow.selectOutbound(flight);
      if (isRoundTrip) {
        const next = new URLSearchParams(criteriaToQuery(criteria));
        next.set('leg', 'return');
        if (filters.sort !== 'price_asc') next.set('sort', filters.sort);
        setParams(next);
        window.scrollTo({ top: 0 });
      } else {
        navigate('/booking/passengers');
      }
    } else {
      flow.selectReturn(flight);
      navigate('/booking/passengers');
    }
  };

  const changeOutbound = () => {
    flow.clearOutbound();
    setParams(new URLSearchParams(criteriaToQuery(criteria)));
  };

  const legOrigin = leg === 'return' ? criteria.destination : criteria.origin;
  const legDestination = leg === 'return' ? criteria.origin : criteria.destination;
  const cityOf = (code: string) => airports.get(code)?.city ?? code;
  const seatsNeeded = seatsRequired(countsOf(criteria));
  const results = data?.results ?? [];
  const activeFilters = hasActiveFilters(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <StepIndicator steps={BOOKING_STEPS} current={0} />

      <div className="card mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
              {cityOf(legOrigin) || '—'} <ArrowRight className="h-5 w-5 text-ink-muted" aria-label="to" /> {cityOf(legDestination) || '—'}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {criteria.departureDate && formatDateWithWeekday(criteria.departureDate)}
              {isRoundTrip && criteria.returnDate && <> – {formatDateWithWeekday(criteria.returnDate)}</>}
              {' · '}
              {passengersSummary(countsOf(criteria))} · {CABIN_LABELS[criteria.cabin]} · {isRoundTrip ? 'Round Trip' : 'One Way'}
            </p>
          </div>
          <button type="button" className="btn-secondary shrink-0" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />} {editing ? 'Close' : 'Modify search'}
          </button>
        </div>
        {editing && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <SearchForm key={criteriaKey} initial={criteria} variant="compact" />
          </div>
        )}
      </div>

      {isRoundTrip && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(['outbound', 'return'] as const).map((l, i) => (
            <div
              key={l}
              className={cx(
                'rounded-2xl border px-4 py-3 text-sm',
                leg === l ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 bg-white',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Step {i + 1}: {l === 'outbound' ? 'Outbound flight' : 'Return flight'}
              </p>
              <p className="mt-0.5 font-semibold">
                {l === 'outbound' ? `${criteria.origin} → ${criteria.destination}` : `${criteria.destination} → ${criteria.origin}`}
                <span className="font-normal text-ink-muted">
                  {' · '}
                  {l === 'outbound' ? criteria.departureDate && formatDateWithWeekday(criteria.departureDate) : criteria.returnDate && formatDateWithWeekday(criteria.returnDate)}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {leg === 'return' && outbound && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-soft">Your outbound flight</p>
            <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={changeOutbound}>
              Change
            </button>
          </div>
          <div className="bg-white">
            <ItineraryFlight direction="OUTBOUND" flight={outbound} cabin={outbound.cabin} price={outbound.price} />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={cx('lg:block', showFilters ? 'block' : 'hidden')} aria-label="Filters">
          <div className="card p-5 lg:sticky lg:top-24">
            <FiltersPanel facets={data?.facets ?? null} filters={filters} onChange={updateFilters} />
          </div>
        </aside>

        <section aria-label="Flight results" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold" aria-live="polite">
              {loading ? 'Searching flights…' : data ? `${plural(data.total, 'flight')} found` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary px-3 py-2 lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {activeFilters && <span className="h-2 w-2 rounded-full bg-accent-600" aria-label="filters active" />}
              </button>
              <label htmlFor="sort" className="sr-only">
                Sort by
              </label>
              <select
                id="sort"
                value={filters.sort}
                onChange={(e) => updateFilters({ ...filters, sort: e.target.value as SortOption })}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Sort: {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && (
            <div className="space-y-3" aria-busy="true">
              <FlightCardSkeleton />
              <FlightCardSkeleton />
              <FlightCardSkeleton />
            </div>
          )}

          {!loading && error && (
            <Alert
              tone="error"
              title={error.status === 400 ? 'Please check your search' : 'We could not load flights'}
              action={
                error.status !== 400 && (
                  <button type="button" className="btn-secondary" onClick={() => setReloadNonce((n) => n + 1)}>
                    Try again
                  </button>
                )
              }
            >
              {error.details.length > 0 ? (
                <ul className="list-disc pl-5">
                  {error.details.map((d) => (
                    <li key={d.field + d.message}>{d.message}</li>
                  ))}
                </ul>
              ) : (
                error.message
              )}
            </Alert>
          )}

          {!loading && !error && data && results.length === 0 && (
            <EmptyState
              icon={<SearchX className="h-7 w-7" />}
              title={activeFilters ? 'No flights match your filters' : 'No flights found'}
              description={
                activeFilters
                  ? 'Try removing some filters to see more options.'
                  : 'There are no flights for this route on the selected date. Try another date or destination.'
              }
              action={
                activeFilters ? (
                  <button type="button" className="btn-secondary" onClick={() => updateFilters({ ...filters, airlines: [], nonstop: false, maxPrice: null, departureTimes: [] })}>
                    Clear filters
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                    <PlaneTakeoff className="h-4 w-4" /> Modify search
                  </button>
                )
              }
            />
          )}

          {!loading && !error && results.length > 0 && (
            <div className="space-y-3">
              {results.map((f) => (
                <FlightCard key={f.id} flight={f} seatsNeeded={seatsNeeded} onSelect={onSelect} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
