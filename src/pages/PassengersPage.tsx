import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import {
  addDaysIso,
  COUNTRIES,
  localTodayIso,
  PASSENGER_TYPE_HINTS,
  PASSENGER_TYPE_LABELS,
  passengerTypeSequence,
  validatePassengers,
  type FieldErrors,
} from '../shared';
import { Alert, cx, Field } from '../common/ui';
import { useBookingFlow } from '../context/BookingFlowContext';
import { DateField } from '../components/DateField';
import { FlowExpired, TripSummary } from '../components/FlowGuard';
import { StepIndicator } from '../components/Itinerary';
import { initialPassengerForm, toPassengerInput, type PassengerDraft } from '../lib/passengers';
import { countsOf, searchUrl, type SearchCriteria } from '../lib/search';
import { BOOKING_STEPS } from './ResultsPage';

export function PassengersPage() {
  const { criteria, outbound, returnFlight } = useBookingFlow();
  const ready = !!criteria && !!outbound && (criteria.tripType === 'ONE_WAY' || !!returnFlight);
  if (!ready) return <FlowExpired />;
  return <PassengerDetails criteria={criteria} travelDate={outbound.departureTime.slice(0, 10)} />;
}

function PassengerDetails({ criteria, travelDate }: { criteria: SearchCriteria; travelDate: string }) {
  const navigate = useNavigate();
  const flow = useBookingFlow();
  const types = useMemo(() => passengerTypeSequence(countsOf(criteria)), [criteria]);
  const [list, setList] = useState<PassengerDraft[]>(() => initialPassengerForm(types));
  const [attempted, setAttempted] = useState(false);
  const today = localTodayIso();

  const errors: FieldErrors = useMemo(
    () => (attempted ? validatePassengers(list.map((p, i) => toPassengerInput(p, i === 0)), { travelDate, today }) : {}),
    [attempted, list, travelDate, today],
  );
  const errorCount = Object.keys(errors).length;

  const update = (index: number, patch: Partial<PassengerDraft>) => setList((l) => l.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const found = validatePassengers(list.map((p, i) => toPassengerInput(p, i === 0)), { travelDate, today });
    const first = Object.keys(found)[0];
    if (first) {
      const [, idx, field] = first.split('.');
      window.setTimeout(() => document.getElementById(`p${idx}-${field}`)?.focus(), 0);
      return;
    }
    flow.savePassengers(list);
    navigate('/booking/review');
  };

  const backUrl = searchUrl(criteria, criteria.tripType === 'ROUND_TRIP' ? { leg: 'return' } : {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <StepIndicator steps={BOOKING_STEPS} current={1} />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} noValidate className="min-w-0 space-y-4" aria-label="Passenger details">
          <div>
            <h1 className="text-2xl font-bold">Passenger details</h1>
            <p className="mt-1 text-sm text-ink-muted">Enter each passenger's details exactly as they appear in their passport.</p>
          </div>

          {errorCount > 0 && (
            <Alert tone="error" title="Please correct the highlighted fields">
              {errorCount} field{errorCount === 1 ? ' needs' : 's need'} your attention.
            </Alert>
          )}

          {list.map((p, i) => (
            <PassengerCard key={i} index={i} passenger={p} errors={errors} today={today} onChange={(patch) => update(i, patch)} />
          ))}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <button type="button" className="btn-secondary" onClick={() => navigate(backUrl)}>
              <ArrowLeft className="h-4 w-4" /> Back to flights
            </button>
            <button type="submit" className="btn-primary px-6">
              Continue to summary <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TripSummary criteria={criteria} />
        </aside>
      </div>
      <p className="sr-only">Passenger types: {types.map((t) => PASSENGER_TYPE_LABELS[t]).join(', ')}</p>
    </div>
  );
}

function PassengerCard({
  index,
  passenger: p,
  errors,
  today,
  onChange,
}: {
  index: number;
  passenger: PassengerDraft;
  errors: FieldErrors;
  today: string;
  onChange: (patch: Partial<PassengerDraft>) => void;
}) {
  const id = (field: string) => `p${index}-${field}`;
  const err = (field: string) => errors[`passengers.${index}.${field}`];
  const describedBy = (field: string) => (err(field) ? `${id(field)}-error` : undefined);
  const primary = index === 0;
  const openTo = p.type === 'ADULT' ? '1990-01-01' : p.type === 'CHILD' ? addDaysIso(today, -365 * 6) : addDaysIso(today, -200);

  return (
    <fieldset className="card p-5 sm:p-6">
      <legend className="sr-only">
        Passenger {index + 1}, {PASSENGER_TYPE_LABELS[p.type]}
      </legend>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-600">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">
            Passenger {index + 1} · {PASSENGER_TYPE_LABELS[p.type]}
          </p>
          <p className="text-xs text-ink-muted">
            {PASSENGER_TYPE_HINTS[p.type]}
            {primary && ' · Primary contact'}
          </p>
        </div>
      </div>

      <div className={'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
        <Field label="First name" htmlFor={id('firstName')} error={err('firstName')} required>
          <input
            id={id('firstName')}
            className={cx('input', err('firstName') && 'input-error')}
            value={p.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            autoComplete={primary ? 'given-name' : 'off'}
            aria-invalid={!!err('firstName') || undefined}
            aria-describedby={describedBy('firstName')}
            maxLength={60}
          />
        </Field>
        <Field label="Last name" htmlFor={id('lastName')} error={err('lastName')} required>
          <input
            id={id('lastName')}
            className={cx('input', err('lastName') && 'input-error')}
            value={p.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            autoComplete={primary ? 'family-name' : 'off'}
            aria-invalid={!!err('lastName') || undefined}
            aria-describedby={describedBy('lastName')}
            maxLength={60}
          />
        </Field>
        <Field label="Date of birth" htmlFor={id('dateOfBirth')} error={err('dateOfBirth')} hint="MM/DD/YYYY" required>
          <DateField
            id={id('dateOfBirth')}
            value={p.dob}
            onChange={(v) => onChange({ dob: v })}
            maxDate={today}
            openTo={openTo}
            yearSelect
            invalid={!!err('dateOfBirth')}
            describedBy={describedBy('dateOfBirth')}
          />
        </Field>
        <Field label="Nationality" htmlFor={id('nationality')} error={err('nationality')} required>
          <select
            id={id('nationality')}
            className={cx('input', err('nationality') && 'input-error')}
            value={p.nationality}
            onChange={(e) => onChange({ nationality: e.target.value })}
            aria-invalid={!!err('nationality') || undefined}
            aria-describedby={describedBy('nationality')}
          >
            <option value="">Select nationality</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Passport number" htmlFor={id('passportNumber')} error={err('passportNumber')} hint="6–9 letters or digits" required>
          <input
            id={id('passportNumber')}
            className={cx('input uppercase', err('passportNumber') && 'input-error')}
            value={p.passportNumber}
            onChange={(e) => onChange({ passportNumber: e.target.value.toUpperCase() })}
            autoComplete="off"
            aria-invalid={!!err('passportNumber') || undefined}
            aria-describedby={describedBy('passportNumber')}
            maxLength={12}
          />
        </Field>
        {primary && (
          <Field label="Email" htmlFor={id('email')} error={err('email')} hint="Booking confirmation will be sent here" required>
            <input
              id={id('email')}
              type="email"
              inputMode="email"
              className={cx('input', err('email') && 'input-error')}
              value={p.email}
              onChange={(e) => onChange({ email: e.target.value })}
              autoComplete="email"
              aria-invalid={!!err('email') || undefined}
              aria-describedby={describedBy('email')}
              maxLength={254}
            />
          </Field>
        )}
      </div>
    </fieldset>
  );
}
