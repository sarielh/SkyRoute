import {
  CABINS,
  DEPARTURE_WINDOWS,
  SORT_OPTIONS,
  TRIP_TYPES,
  isValidIsoDate,
  seatsRequired,
  type AirportDTO,
  type ApiErrorDetail,
  type Cabin,
  type DepartureWindow,
  type FlightDTO,
  type SearchLeg,
  type SearchResponse,
  type SortOption,
  type TripType,
  type UnavailableReason,
} from '../shared';
import { MAX_PASSENGERS } from './config';
import { validationError } from './errors';
import { airportByCode, amount, cabinOffered, cabinPriceCents, findFlights, toFlightCore, type Flight } from './flights';
import { availableSeats } from './seats';

export interface SearchFilters {
  airlines: string[] | null;
  nonstop: boolean;
  maxPrice: number | null;
  departureWindows: DepartureWindow[] | null;
}

export interface ParsedSearch {
  tripType: TripType;
  origin: AirportDTO;
  destination: AirportDTO;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  leg: SearchLeg;
  sort: SortOption;
  filters: SearchFilters;
}

export type Query = Record<string, string | string[] | undefined>;

function str(q: Query, key: string): string | undefined {
  const v = q[key];
  const first = Array.isArray(v) ? v[0] : v;
  return typeof first === 'string' && first.trim() !== '' ? first.trim() : undefined;
}

function list(q: Query, key: string): string[] | null {
  const v = str(q, key);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null;
}

const COUNT_LABELS = { adults: 'Number of adults', children: 'Number of children', infants: 'Number of infants' } as const;

export function validateSearch(q: Query): ParsedSearch {
  const errors: ApiErrorDetail[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  const tripType = (str(q, 'tripType') ?? 'ONE_WAY').toUpperCase() as TripType;
  if (!TRIP_TYPES.includes(tripType)) add('tripType', 'Trip type must be ONE_WAY or ROUND_TRIP.');

  const originCode = str(q, 'origin')?.toUpperCase();
  const destinationCode = str(q, 'destination')?.toUpperCase();
  const origin = originCode ? airportByCode.get(originCode) : undefined;
  const destination = destinationCode ? airportByCode.get(destinationCode) : undefined;
  if (!originCode) add('origin', 'Please select an origin airport.');
  else if (!origin) add('origin', `Origin airport "${originCode}" is not recognised.`);
  if (!destinationCode) add('destination', 'Please select a destination airport.');
  else if (!destination) add('destination', `Destination airport "${destinationCode}" is not recognised.`);

  const departureDate = str(q, 'departureDate');
  if (!departureDate) add('departureDate', 'Please select a departure date.');
  else if (!isValidIsoDate(departureDate)) add('departureDate', 'Departure date must be a valid date (YYYY-MM-DD).');

  let returnDate: string | null = null;
  if (tripType === 'ROUND_TRIP') {
    const raw = str(q, 'returnDate');
    if (!raw) add('returnDate', 'Please select a return date.');
    else if (!isValidIsoDate(raw)) add('returnDate', 'Return date must be a valid date (YYYY-MM-DD).');
    else returnDate = raw;
  }

  const counts = { adults: 1, children: 0, infants: 0 };
  for (const key of ['adults', 'children', 'infants'] as const) {
    const raw = str(q, key);
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n > 99) add(key, `${COUNT_LABELS[key]} must be a whole number.`);
    else counts[key] = n;
  }
  if (counts.adults < 1) add('adults', 'At least one adult passenger is required.');
  if (counts.adults + counts.children + counts.infants > MAX_PASSENGERS) {
    add('passengers', `A maximum of ${MAX_PASSENGERS} passengers can be booked at once.`);
  }
  if (counts.infants > counts.adults) add('infants', 'The number of infants cannot exceed the number of adults.');

  const cabin = (str(q, 'cabin') ?? 'ECONOMY').toUpperCase() as Cabin;
  if (!CABINS.includes(cabin)) add('cabin', 'Cabin class must be ECONOMY or BUSINESS.');

  const leg = (str(q, 'leg') ?? 'outbound').toLowerCase() as SearchLeg;
  if (leg !== 'outbound' && leg !== 'return') add('leg', 'Leg must be "outbound" or "return".');
  else if (leg === 'return' && tripType !== 'ROUND_TRIP') add('leg', 'Return flights can only be searched for round trips.');

  const sort = (str(q, 'sort') ?? 'price_asc') as SortOption;
  if (!SORT_OPTIONS.includes(sort)) add('sort', `Sort must be one of: ${SORT_OPTIONS.join(', ')}.`);

  const airlines = list(q, 'airlines')?.map((a) => a.toUpperCase()) ?? null;
  if (airlines?.some((a) => !/^[A-Z0-9]{2}$/.test(a))) add('airlines', 'Airlines must be a comma-separated list of 2-character airline codes.');

  const nonstopRaw = str(q, 'nonstop');
  if (nonstopRaw && !['true', 'false', '1', '0'].includes(nonstopRaw)) add('nonstop', 'Nonstop must be true or false.');

  let maxPrice: number | null = null;
  const maxPriceRaw = str(q, 'maxPrice');
  if (maxPriceRaw !== undefined) {
    maxPrice = Number(maxPriceRaw);
    if (!Number.isFinite(maxPrice) || maxPrice <= 0) add('maxPrice', 'Maximum price must be a positive number.');
  }

  const windows = list(q, 'departureTimes') as DepartureWindow[] | null;
  const windowIds = DEPARTURE_WINDOWS.map((w) => w.id);
  if (windows?.some((w) => !windowIds.includes(w))) add('departureTimes', `Departure times must be any of: ${windowIds.join(', ')}.`);

  if (errors.length > 0) throw validationError(errors, 'Please correct the highlighted search fields.');

  return {
    tripType,
    origin: origin!,
    destination: destination!,
    departureDate: departureDate!,
    returnDate,
    ...counts,
    cabin,
    leg,
    sort,
    filters: {
      airlines,
      nonstop: nonstopRaw === 'true' || nonstopRaw === '1',
      maxPrice,
      departureWindows: windows,
    },
  };
}

function localMinutes(isoWithOffset: string): number {
  return Number(isoWithOffset.slice(11, 13)) * 60 + Number(isoWithOffset.slice(14, 16));
}

const SHORT_CONNECTION_MINUTES = 120;

export function applyFilters(flights: FlightDTO[], f: SearchFilters): FlightDTO[] {
  return flights.filter((fl) => {
    if (f.airlines && !f.airlines.includes(fl.airline.code)) return false;
    if (f.nonstop && !(fl.stops === 0 || (fl.layover?.durationMinutes ?? 0) < SHORT_CONNECTION_MINUTES)) return false;
    if (f.maxPrice !== null && fl.price > f.maxPrice) return false;
    if (f.departureWindows) {
      const m = localMinutes(fl.departureTime);
      const inWindow = DEPARTURE_WINDOWS.some((w) => f.departureWindows!.includes(w.id) && m >= w.from && m < w.to);
      if (!inWindow) return false;
    }
    return true;
  });
}

export function sortFlights(flights: FlightDTO[], sort: SortOption): FlightDTO[] {
  const byDeparture = (a: FlightDTO, b: FlightDTO) => Date.parse(a.departureTime) - Date.parse(b.departureTime);
  const byPrice = (a: FlightDTO, b: FlightDTO): number => {
    const sa = a.price.toFixed(2);
    const sb = b.price.toFixed(2);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  };
  const sorted = [...flights];
  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => byPrice(a, b) || byDeparture(a, b));
    case 'price_desc':
      return sorted.sort((a, b) => byPrice(b, a) || byDeparture(a, b));
    case 'duration':
      return sorted.sort((a, b) => a.durationMinutes - b.durationMinutes || a.price - b.price);
    case 'departure':
      return sorted.sort((a, b) => byDeparture(a, b) || a.price - b.price);
  }
}

function toSearchDTO(f: Flight, cabin: Cabin, available: number, required: number): FlightDTO {
  let reason: UnavailableReason | null = null;
  if (available === 0) reason = 'SOLD_OUT';
  else if (available < required) reason = 'INSUFFICIENT_SEATS';
  return {
    ...toFlightCore(f),
    cabin,
    price: amount(cabinPriceCents(f, cabin) ?? 0),
    availableSeats: available,
    bookable: reason === null,
    unavailableReason: reason,
  };
}

export function searchFlights(q: Query): SearchResponse {
  const p = validateSearch(q);
  const isReturn = p.leg === 'return';
  const legOrigin = isReturn ? p.destination : p.origin;
  const legDestination = isReturn ? p.origin : p.destination;
  const legDate = isReturn ? p.returnDate! : p.departureDate;

  const candidates = findFlights(legOrigin.code, legDestination.code, legDate).filter((f) => cabinOffered(f, p.cabin));
  const required = seatsRequired(p);
  const all = candidates.map((f) => toSearchDTO(f, p.cabin, availableSeats(f, p.cabin), required));

  const airlineFacets = new Map<string, { code: string; name: string; count: number; minPrice: number }>();
  for (const f of all) {
    const facet = airlineFacets.get(f.airline.code);
    if (facet) {
      facet.count += 1;
      facet.minPrice = Math.min(facet.minPrice, f.price);
    } else {
      airlineFacets.set(f.airline.code, { code: f.airline.code, name: f.airline.name, count: 1, minPrice: f.price });
    }
  }
  const prices = all.map((f) => f.price);
  const results = sortFlights(applyFilters(all, p.filters), p.sort);

  return {
    query: {
      tripType: p.tripType,
      origin: p.origin.code,
      destination: p.destination.code,
      departureDate: p.departureDate,
      returnDate: p.returnDate,
      adults: p.adults,
      children: p.children,
      infants: p.infants,
      cabin: p.cabin,
      leg: p.leg,
      legOrigin: legOrigin.code,
      legDestination: legDestination.code,
      legDate,
      sort: p.sort,
    },
    total: all.length,
    results,
    facets: {
      airlines: [...airlineFacets.values()].sort((a, b) => a.name.localeCompare(b.name)),
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    },
  };
}
