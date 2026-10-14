import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { PASSENGER_TYPE_HINTS, type PassengerCounts } from '../shared';
import { cx } from '../common/ui';
import { passengersSummary } from '../lib/format';

interface Props {
  id: string;
  value: PassengerCounts;
  onChange: (value: PassengerCounts) => void;
  max: number;
  invalid?: boolean;
  describedBy?: string;
}

const ROWS: { key: keyof PassengerCounts; label: string; hint: string }[] = [
  { key: 'adults', label: 'Adults', hint: PASSENGER_TYPE_HINTS.ADULT },
  { key: 'children', label: 'Children', hint: PASSENGER_TYPE_HINTS.CHILD },
  { key: 'infants', label: 'Infants', hint: `${PASSENGER_TYPE_HINTS.INFANT}, on lap` },
];

export function PassengerPicker({ id, value, onChange, max, invalid, describedBy }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = value.adults + value.children + value.infants;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const canIncrement = (key: keyof PassengerCounts) => total < max && (key !== 'infants' || value.infants < value.adults);
  const canDecrement = (key: keyof PassengerCounts) =>
    key === 'adults' ? value.adults > 1 && value.adults > value.infants : value[key] > 0;

  const set = (key: keyof PassengerCounts, delta: number) => onChange({ ...value, [key]: value[key] + delta });

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx('input flex items-center gap-2.5 pl-3.5 text-left', invalid && 'input-error')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
      >
        <Users className="h-5 w-5 shrink-0 text-ink-muted" />
        <span className="truncate">{passengersSummary(value)}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Passengers" className="absolute right-0 z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] animate-fade-in rounded-2xl border border-slate-200 bg-white p-4 shadow-pop">
          <div className="space-y-4">
            {ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs text-ink-muted">{row.hint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-ink-soft transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-300 disabled:hover:text-ink-soft"
                    onClick={() => set(row.key, -1)}
                    disabled={!canDecrement(row.key)}
                    aria-label={`Remove one ${row.label.toLowerCase().replace(/ren$|s$/, '')}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-label={`${value[row.key]} ${row.label}`}>
                    {value[row.key]}
                  </span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-ink-soft transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-300 disabled:hover:text-ink-soft"
                    onClick={() => set(row.key, 1)}
                    disabled={!canIncrement(row.key)}
                    aria-label={`Add one ${row.label.toLowerCase().replace(/ren$|s$/, '')}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-ink-muted">
            Up to 9 passengers per booking. Each infant must travel with an adult.
          </p>
          <button type="button" className="btn-primary mt-3 w-full" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
