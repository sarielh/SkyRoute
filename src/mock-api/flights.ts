// Deterministic flight timetable. Flights are generated on demand from the static
// route data for a rolling window around today, so dates never go stale.
import { addDaysIso, centsToAmount, diffDaysIso, localTodayIso } from '../shared';
import type { AirlineDTO, AirportDTO, Cabin, FlightCoreDTO } from '../shared';
import airlinesJson from './data/airlines.json';
import airportsJson from './data/airports.json';
import routesJson from './data/routes.json';
import { toZonedIso, zonedToUtc } from './time';

/** Flights exist from this many days before today until this many days after today. */
export const WINDOW_DAY_FROM = -3;
export const WINDOW_DAY_TO = 59;

/** Fixed calendar anchor so that a flight on a given date never changes from one day to the next. */
const ANCHOR_DATE = '2026-01-01';

interface AirlineSeed {
  code: string;
  name: string;
  lowCost: boolean;
  economySeats: number;
  businessSeats: number;
}

interface DepartureSeed {
  airline: string;
  number: number;
  time: string;
  factor: number;
  via?: string;
  layoverMinutes?: number;
  totalMinutes?: number;
  economySeats?: number[];
  businessSeats?: number[];
  skipEvery?: number;
}

interface RouteSeed {
  from: string;
  to: string;
  minutes: number;
  base: number;
  biz: number;
  flights: DepartureSeed[];
}

export const AIRPORTS: AirportDTO[] = airportsJson;
export const AIRLINES: AirlineSeed[] = airlinesJson;
const ROUTES: RouteSeed[] = routesJson;

export const airportByCode = new Map(AIRPORTS.map((a) => [a.code, a]));
export const airlineByCode = new Map(AIRLINES.map((a) => [a.code, a]));

export interface Flight {
  id: string;
  flightNumber: string;
  airline: AirlineDTO;
  origin: AirportDTO;
  destination: AirportDTO;
  layover: AirportDTO | null;
  departureUtc: Date;
  arrivalUtc: Date;
  departureLocalDate: string;
  durationMinutes: number;
  stops: number;
  layoverMinutes: number | null;
  economyPriceCents: number;
  economySeatsTotal: number;
  economySeatsInitial: number;
  businessPriceCents: number | null;
  businessSeatsTotal: number;
  businessSeatsInitial: number;
}

/** Small deterministic integer hash (no randomness anywhere in the timetable). */
function mix(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h ^= v & 0xffff;
    h = Math.imul(h, 0x01000193);
    h ^= v >>> 16;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

function cycle(values: number[], day: number): number {
  const n = values.length;
  return values[((day % n) + n) % n];
}

/** Fares rise close to departure and drop for flights booked well in advance. */
function leadFactor(daysAhead: number): number {
  if (daysAhead < 0) return 1;
  if (daysAhead <= 2) return 1.3;
  if (daysAhead <= 7) return 1.12;
  if (daysAhead <= 21) return 1;
  return 0.92;
}

/** Deterministic +/-10% day-to-day variation. */
function wobble(day: number, routeIdx: number, depIdx: number): number {
  return 1 + ((((day + 100) * 7 + routeIdx * 5 + depIdx * 3) % 9) - 4) * 0.025;
}

function economySeats(dep: DepartureSeed, total: number, h: number, day: number): number {
  if (dep.economySeats) return Math.min(total, cycle(dep.economySeats, day));
  const bucket = h % 100;
  const v = h >>> 8;
  if (bucket < 3) return 0;
  if (bucket < 12) return 1 + (v % 4);
  if (bucket < 22) return 5 + (v % 5);
  return Math.min(total, 10 + (v % (total - 40)));
}

function businessSeats(dep: DepartureSeed, total: number, h: number, day: number): number {
  if (total === 0) return 0;
  if (dep.businessSeats) return Math.min(total, cycle(dep.businessSeats, day));
  const bucket = h % 100;
  const v = h >>> 8;
  if (bucket < 8) return 0;
  if (bucket < 28) return 1 + (v % 3);
  return Math.min(total, 4 + (v % (total - 3)));
}

interface Departure {
  route: RouteSeed;
  routeIdx: number;
  dep: DepartureSeed;
  depIdx: number;
}

const departuresByRoute = new Map<string, Departure[]>();
const departureByNumber = new Map<string, Departure>();
ROUTES.forEach((route, routeIdx) => {
  route.flights.forEach((dep, depIdx) => {
    const d = { route, routeIdx, dep, depIdx };
    const key = `${route.from}-${route.to}`;
    departuresByRoute.set(key, [...(departuresByRoute.get(key) ?? []), d]);
    departureByNumber.set(`${dep.airline}${dep.number}`, d);
  });
});

export function inWindow(date: string, today: string = localTodayIso()): boolean {
  const offset = diffDaysIso(date, today);
  return offset >= WINDOW_DAY_FROM && offset <= WINDOW_DAY_TO;
}

function build({ route, routeIdx, dep, depIdx }: Departure, date: string, today: string): Flight | null {
  const day = diffDaysIso(date, ANCHOR_DATE);
  if (dep.skipEvery && ((day % dep.skipEvery) + dep.skipEvery) % dep.skipEvery === 0) return null;

  const airline = airlineByCode.get(dep.airline)!;
  const origin = airportByCode.get(route.from)!;
  const destination = airportByCode.get(route.to)!;
  const departureUtc = zonedToUtc(date, dep.time, origin.timezone);
  const durationMinutes = dep.totalMinutes ?? route.minutes;

  const priceFactor = leadFactor(diffDaysIso(date, today)) * wobble(day, routeIdx, depIdx);
  const economyDollars = Math.max(29, Math.round(route.base * dep.factor * priceFactor));
  const h1 = mix(routeIdx, depIdx, day + 1000, 1);
  const h2 = mix(routeIdx, depIdx, day + 1000, 2);

  return {
    id: `${dep.airline}${dep.number}-${date.replace(/-/g, '')}`,
    flightNumber: `${dep.airline} ${dep.number}`,
    airline: { code: airline.code, name: airline.name },
    origin,
    destination,
    layover: dep.via ? airportByCode.get(dep.via)! : null,
    departureUtc,
    arrivalUtc: new Date(departureUtc.getTime() + durationMinutes * 60000),
    departureLocalDate: date,
    durationMinutes,
    stops: dep.via ? 1 : 0,
    layoverMinutes: dep.via ? dep.layoverMinutes ?? null : null,
    economyPriceCents: airline.lowCost ? economyDollars * 100 - 1 : economyDollars * 100,
    economySeatsTotal: airline.economySeats,
    economySeatsInitial: economySeats(dep, airline.economySeats, h1, day),
    businessPriceCents: airline.lowCost
      ? null
      : Math.round((route.base * Math.max(dep.factor, 0.9) * route.biz * priceFactor) / 5) * 5 * 100,
    businessSeatsTotal: airline.businessSeats,
    businessSeatsInitial: businessSeats(dep, airline.businessSeats, h2, day),
  };
}

/** All flights on a route departing on a local calendar date (origin airport time). */
export function findFlights(originCode: string, destinationCode: string, date: string): Flight[] {
  const today = localTodayIso();
  if (!inWindow(date, today)) return [];
  return (departuresByRoute.get(`${originCode}-${destinationCode}`) ?? [])
    .map((d) => build(d, date, today))
    .filter((f): f is Flight => f !== null);
}

export function getFlight(id: string): Flight | null {
  const m = /^([A-Z0-9]{2}\d+)-(\d{4})(\d{2})(\d{2})$/.exec(id);
  if (!m) return null;
  const departure = departureByNumber.get(m[1]);
  const date = `${m[2]}-${m[3]}-${m[4]}`;
  const today = localTodayIso();
  if (!departure || !inWindow(date, today)) return null;
  return build(departure, date, today);
}

/** Number of flights in the current window (used by the health endpoint). */
export function countFlights(): number {
  const today = localTodayIso();
  let n = 0;
  for (let offset = WINDOW_DAY_FROM; offset <= WINDOW_DAY_TO; offset++) {
    const date = addDaysIso(today, offset);
    const day = diffDaysIso(date, ANCHOR_DATE);
    for (const { dep } of departureByNumber.values()) {
      if (!(dep.skipEvery && ((day % dep.skipEvery) + dep.skipEvery) % dep.skipEvery === 0)) n++;
    }
  }
  return n;
}

export function toFlightCore(f: Flight): FlightCoreDTO {
  return {
    id: f.id,
    flightNumber: f.flightNumber,
    airline: f.airline,
    origin: f.origin,
    destination: f.destination,
    departureTime: toZonedIso(f.departureUtc, f.origin.timezone),
    arrivalTime: toZonedIso(f.arrivalUtc, f.destination.timezone),
    durationMinutes: f.durationMinutes,
    stops: f.stops,
    layover: f.layover ? { airport: f.layover, durationMinutes: f.layoverMinutes ?? 0 } : null,
  };
}

export function cabinPriceCents(f: Flight, cabin: Cabin): number | null {
  return cabin === 'BUSINESS' ? f.businessPriceCents : f.economyPriceCents;
}

export function cabinInitialSeats(f: Flight, cabin: Cabin): number {
  return cabin === 'BUSINESS' ? f.businessSeatsInitial : f.economySeatsInitial;
}

export function cabinOffered(f: Flight, cabin: Cabin): boolean {
  return cabin === 'ECONOMY' || (f.businessPriceCents !== null && f.businessSeatsTotal > 0);
}

export const amount = centsToAmount;
