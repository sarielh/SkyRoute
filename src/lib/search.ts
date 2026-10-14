import {
  DEPARTURE_WINDOWS,
  SORT_OPTIONS,
  type Cabin,
  type DepartureWindow,
  type PassengerCounts,
  type SearchLeg,
  type SortOption,
  type TripType,
} from '../shared';

export interface SearchCriteria {
  tripType: TripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
}

export interface ResultFilters {
  sort: SortOption;
  airlines: string[];
  nonstop: boolean;
  maxPrice: number | null;
  departureTimes: DepartureWindow[];
}

export const DEFAULT_FILTERS: ResultFilters = { sort: 'price_asc', airlines: [], nonstop: false, maxPrice: null, departureTimes: [] };

function int(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function criteriaToQuery(c: SearchCriteria): Record<string, string> {
  const q: Record<string, string> = {
    tripType: c.tripType,
    origin: c.origin,
    destination: c.destination,
    departureDate: c.departureDate,
    adults: String(c.adults),
    children: String(c.children),
    infants: String(c.infants),
    cabin: c.cabin,
  };
  if (c.tripType === 'ROUND_TRIP' && c.returnDate) q.returnDate = c.returnDate;
  return q;
}

export function readCriteria(p: URLSearchParams): SearchCriteria {
  const tripType = p.get('tripType') === 'ROUND_TRIP' ? 'ROUND_TRIP' : 'ONE_WAY';
  return {
    tripType,
    origin: (p.get('origin') ?? '').toUpperCase(),
    destination: (p.get('destination') ?? '').toUpperCase(),
    departureDate: p.get('departureDate') ?? '',
    returnDate: tripType === 'ROUND_TRIP' ? p.get('returnDate') : null,
    adults: int(p.get('adults'), 1),
    children: int(p.get('children'), 0),
    infants: int(p.get('infants'), 0),
    cabin: p.get('cabin') === 'BUSINESS' ? 'BUSINESS' : 'ECONOMY',
  };
}

export function readLeg(p: URLSearchParams): SearchLeg {
  return p.get('leg') === 'return' ? 'return' : 'outbound';
}

export function readFilters(p: URLSearchParams): ResultFilters {
  const sort = p.get('sort') as SortOption | null;
  const windows = (p.get('departureTimes') ?? '').split(',').filter((w): w is DepartureWindow => DEPARTURE_WINDOWS.some((d) => d.id === w));
  const maxPrice = p.get('maxPrice');
  return {
    sort: sort && SORT_OPTIONS.includes(sort) ? sort : 'price_asc',
    airlines: (p.get('airlines') ?? '').split(',').filter(Boolean),
    nonstop: p.get('nonstop') === 'true',
    maxPrice: maxPrice && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null,
    departureTimes: windows,
  };
}

export function filtersToQuery(f: ResultFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.sort !== 'price_asc') q.sort = f.sort;
  if (f.airlines.length) q.airlines = f.airlines.join(',');
  if (f.nonstop) q.nonstop = 'true';
  if (f.maxPrice !== null) q.maxPrice = String(f.maxPrice);
  if (f.departureTimes.length) q.departureTimes = f.departureTimes.join(',');
  return q;
}

export function hasActiveFilters(f: ResultFilters): boolean {
  return f.airlines.length > 0 || f.nonstop || f.maxPrice !== null || f.departureTimes.length > 0;
}

export function countsOf(c: SearchCriteria): PassengerCounts {
  return { adults: c.adults, children: c.children, infants: c.infants };
}

export function sameCriteria(a: SearchCriteria | null, b: SearchCriteria | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(criteriaToQuery(a)) === JSON.stringify(criteriaToQuery(b));
}

export function searchUrl(c: SearchCriteria, extra: Record<string, string> = {}): string {
  return `/search?${new URLSearchParams({ ...criteriaToQuery(c), ...extra }).toString()}`;
}
