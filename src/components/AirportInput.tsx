import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { AirportDTO } from '../shared';
import { cx, Spinner } from '../common/ui';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { airportLabel } from '../lib/format';

interface Props {
  id: string;
  value: AirportDTO | null;
  onChange: (airport: AirportDTO | null) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  icon?: ReactNode;
}

export function AirportInput({ id, value, onChange, placeholder, invalid, describedBy, icon }: Props) {
  const { config } = useApp();
  const listId = useId();
  const [text, setText] = useState(value ? airportLabel(value) : '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AirportDTO[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef<number>();

  useEffect(() => {
    setText(value ? airportLabel(value) : '');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const query = value && text === airportLabel(value) ? '' : text.trim();
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      api
        .airports(query, config.search.airportSuggestionLimit, ctrl.signal)
        .then((r) => {
          setItems(r.airports);
          setActive(0);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, config.search.suggestionDebounceMs);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [text, open, value, config.search.airportSuggestionLimit, config.search.suggestionDebounceMs]);

  const choose = (a: AirportDTO) => {
    onChange(a);
    setText(airportLabel(a));
    setOpen(false);
  };

  const onBlur = () => {
    blurTimer.current = window.setTimeout(() => {
      setOpen(false);
      if (!value && text.trim()) {
        const t = text.trim().toUpperCase();
        const exact = items.find((a) => a.code === t || airportLabel(a).toUpperCase() === t);
        if (exact) choose(exact);
      }
    }, 150);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted">{icon ?? <MapPin className="h-5 w-5" />}</span>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].code}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={placeholder}
        className={cx('input pl-11', invalid && 'input-error')}
        value={text}
        onFocus={(e) => {
          window.clearTimeout(blurTimer.current);
          setOpen(true);
          e.target.select();
        }}
        onBlur={onBlur}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-40 mt-2 max-h-80 animate-fade-in overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop">
          {loading && items.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-ink-muted">
              <Spinner /> Searching airports…
            </li>
          )}
          {!loading && items.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">No airports match “{text}”.</li>}
          {items.map((a, i) => (
            <li
              key={a.code}
              id={`${listId}-${a.code}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(a)}
              className={cx('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-brand-50')}
            >
              <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold tracking-wide text-ink-soft">{a.code}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {a.city}, {a.country}
                </span>
                <span className="block truncate text-xs text-ink-muted">{a.name}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
