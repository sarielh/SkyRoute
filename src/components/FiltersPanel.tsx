import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEPARTURE_WINDOWS, formatUSD, type SearchResponse } from '../shared';
import { cx } from '../common/ui';
import { hasActiveFilters, type ResultFilters } from '../lib/search';

interface Props {
  facets: SearchResponse['facets'] | null;
  filters: ResultFilters;
  onChange: (f: ResultFilters) => void;
}

export function FiltersPanel({ facets, filters, onChange }: Props) {
  const bounds = facets?.price ?? null;
  const minBound = bounds ? Math.floor(bounds.min) : 0;
  const maxBound = bounds ? Math.ceil(bounds.max) : 0;
  const [price, setPrice] = useState<number>(filters.maxPrice ?? maxBound);

  useEffect(() => {
    setPrice(filters.maxPrice ?? maxBound);
  }, [filters.maxPrice, maxBound]);

  useEffect(() => {
    if (!bounds) return;
    const next = price >= maxBound ? null : price;
    if (next === filters.maxPrice) return;
    const t = setTimeout(() => onChange({ ...filters, maxPrice: next }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  const toggleAirline = (code: string) =>
    onChange({
      ...filters,
      airlines: filters.airlines.includes(code) ? filters.airlines.filter((a) => a !== code) : [...filters.airlines, code],
    });

  const toggleWindow = (id: (typeof DEPARTURE_WINDOWS)[number]['id']) =>
    onChange({
      ...filters,
      departureTimes: filters.departureTimes.includes(id) ? filters.departureTimes.filter((w) => w !== id) : [...filters.departureTimes, id],
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filters</h2>
        {hasActiveFilters(filters) && (
          <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => onChange({ ...filters, airlines: [], nonstop: false, maxPrice: null, departureTimes: [] })}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">Stops</h3>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:border-brand-300">
          <span>Nonstop only</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={filters.nonstop}
            onChange={(e) => onChange({ ...filters, nonstop: e.target.checked })}
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">Airlines</h3>
        <div className="space-y-1">
          {(facets?.airlines ?? []).map((a) => (
            <label key={a.code} className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={filters.airlines.includes(a.code)}
                onChange={() => toggleAirline(a.code)}
              />
              <span className="flex-1">{a.name}</span>
              <span className="text-xs text-ink-muted">from {formatUSD(a.minPrice)}</span>
            </label>
          ))}
          {facets && facets.airlines.length === 0 && <p className="text-sm text-ink-muted">No airlines</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-soft">
            <label htmlFor="max-price">Maximum price</label>
          </h3>
          <span className="text-sm font-semibold text-brand-700">{bounds ? (price >= maxBound ? 'Any' : formatUSD(price)) : '-'}</span>
        </div>
        <input
          id="max-price"
          type="range"
          className="w-full accent-brand-600"
          min={minBound}
          max={maxBound}
          step={1}
          value={Math.min(Math.max(price, minBound), maxBound)}
          disabled={!bounds || minBound === maxBound}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        {bounds && (
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>{formatUSD(minBound)}</span>
            <span>{formatUSD(maxBound)}</span>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">Departure time</h3>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTURE_WINDOWS.map((w) => {
            const on = filters.departureTimes.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWindow(w.id)}
                className={cx(
                  'rounded-xl border px-2 py-2 text-left text-sm transition',
                  on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 hover:border-brand-300',
                )}
              >
                <span className="block font-semibold">{w.label}</span>
                <span className="block text-xs text-ink-muted">{w.range}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
