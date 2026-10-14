import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysIso, formatUsDate, parseUsDate } from '../shared';
import { cx } from '../common/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Formats raw keyboard input as MM/DD/YYYY while typing. */
export function maskUsDate(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

interface Props {
  id: string;
  value: string;
  onChange: (text: string) => void;
  /** Earliest selectable day in the calendar (YYYY-MM-DD) */
  minDate?: string;
  /** Latest selectable day in the calendar (YYYY-MM-DD) */
  maxDate?: string;
  /** Month shown when the field is empty (YYYY-MM-DD) */
  openTo?: string;
  invalid?: boolean;
  describedBy?: string;
  yearSelect?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function DateField({ id, value, onChange, minDate, maxDate, openTo, invalid, describedBy, yearSelect, placeholder = 'MM/DD/YYYY', className, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const selected = parseUsDate(value);
  const anchor = selected ?? openTo ?? minDate ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = useState(() => ({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 }));

  useEffect(() => {
    if (open) {
      const a = parseUsDate(value) ?? openTo ?? minDate ?? new Date().toISOString().slice(0, 10);
      setView({ y: Number(a.slice(0, 4)), m: Number(a.slice(5, 7)) - 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = `${view.y}-${pad(view.m + 1)}-01`;
    const startDow = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const list: (string | null)[] = Array(startDow).fill(null);
    for (let d = 0; d < daysInMonth; d++) list.push(addDaysIso(first, d));
    return list;
  }, [view]);

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  })();

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1900 + 2 }, (_, i) => thisYear + 1 - i);

  return (
    <div ref={wrapper} className={cx('relative', className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(maskUsDate(e.target.value))}
        className={cx('input pr-11', invalid && 'input-error')}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        maxLength={10}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-muted hover:text-brand-600"
        aria-label="Open calendar"
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
      >
        <CalendarDays className="h-5 w-5" />
      </button>

      {open && (
        <div
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] animate-fade-in rounded-2xl border border-slate-200 bg-white p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-100" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {yearSelect ? (
              <div className="flex gap-1.5">
                <select aria-label="Month" className="rounded-lg border border-slate-200 px-1.5 py-1 text-sm" value={view.m} onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>
                      {m.slice(0, 3)}
                    </option>
                  ))}
                </select>
                <select aria-label="Year" className="rounded-lg border border-slate-200 px-1.5 py-1 text-sm" value={view.y} onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm font-semibold">
                {MONTHS[view.m]} {view.y}
              </p>
            )}
            <button type="button" onClick={() => shift(1)} className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-100" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold uppercase text-ink-muted">
            {DAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`e${i}`} />;
              const disabled = (minDate && iso < minDate) || (maxDate && iso > maxDate);
              const isSelected = iso === selected;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!!disabled}
                  onClick={() => {
                    onChange(formatUsDate(iso));
                    setOpen(false);
                  }}
                  className={cx(
                    'h-9 rounded-lg text-sm transition',
                    isSelected ? 'bg-brand-600 font-semibold text-white' : 'hover:bg-brand-50',
                    !isSelected && iso === today && 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-300',
                    disabled && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
                  )}
                  aria-label={formatUsDate(iso)}
                  aria-pressed={isSelected}
                >
                  {Number(iso.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
