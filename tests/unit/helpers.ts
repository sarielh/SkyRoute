import { addDaysIso, localTodayIso, type CreateBookingRequest, type PassengerInput } from '../../src/shared';
import routes from '../../src/mock-api/data/routes.json';
import { cabinInitialSeats, findFlights, type Flight } from '../../src/mock-api/flights';
import { handleApiRequest } from '../../src/mock-api/router';
import { availableSeats } from '../../src/mock-api/seats';
import { clearAppStorage } from '../../src/mock-api/store';

export interface ApiResult<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

/** Calls the simulated API exactly as the browser does (Request in, Response out). */
export async function call<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  const init: RequestInit = { method, headers: { Accept: 'application/json', ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const res = await handleApiRequest(new Request(`http://localhost/SkyRoute/api${path}`, init), { bookingDelayMs: 0 });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

export const get = <T = any>(path: string, query: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  return call<T>('GET', qs ? `${path}?${qs}` : path);
};
export const post = <T = any>(path: string, body?: unknown, headers?: Record<string, string>) => call<T>('POST', path, body, headers);

export function day(offset: number): string {
  return addDaysIso(localTodayIso(), offset);
}

export function resetData(): void {
  clearAppStorage();
}

function* allFlights(fromDay: number, toDay: number): Generator<Flight> {
  for (let d = fromDay; d <= toDay; d++) {
    for (const r of routes) yield* findFlights(r.from, r.to, day(d));
  }
}

/** First flight (by departure) departing within the given window with enough Economy seats. */
export function pickFlight(opts: { minHours: number; maxHours: number; seats?: number; origin?: string; destination?: string }): Flight {
  const now = Date.now();
  const list = [...allFlights(-1, 20)]
    .filter(
      (f) =>
        f.departureUtc.getTime() > now + opts.minHours * 3600_000 &&
        f.departureUtc.getTime() < now + opts.maxHours * 3600_000 &&
        cabinInitialSeats(f, 'ECONOMY') >= (opts.seats ?? 9) &&
        (!opts.origin || f.origin.code === opts.origin) &&
        (!opts.destination || f.destination.code === opts.destination),
    )
    .sort((a, b) => a.departureUtc.getTime() - b.departureUtc.getTime());
  if (!list.length) throw new Error('No suitable flight');
  return list[0];
}

/** A nonstop TLV->LHR flight 5 days out and a LHR->TLV return 10 days out. */
export function roundTripFlights(): { out: Flight; ret: Flight } {
  const pick = (o: string, d: string, date: string) => {
    const f = findFlights(o, d, date).find((x) => x.stops === 0 && x.economySeatsInitial >= 9);
    if (!f) throw new Error(`No flight ${o}-${d} on ${date}`);
    return f;
  };
  return { out: pick('TLV', 'LHR', day(5)), ret: pick('LHR', 'TLV', day(10)) };
}

let passportSeq = 100000;

export function passenger(type: PassengerInput['type'], overrides: Partial<PassengerInput> = {}): PassengerInput {
  const dob = type === 'ADULT' ? '1988-03-14' : type === 'CHILD' ? addDaysIso(localTodayIso(), -365 * 6) : addDaysIso(localTodayIso(), -200);
  passportSeq += 1;
  const letters = String(passportSeq)
    .split('')
    .map((d) => 'abcdefghij'[Number(d)])
    .join('');
  return { type, firstName: `Alex${letters}`, lastName: 'Tester', dateOfBirth: dob, nationality: 'IL', passportNumber: `P${passportSeq}`, ...overrides };
}

export function passengers(adults: number, children = 0, infants = 0): PassengerInput[] {
  const list = [
    ...Array.from({ length: adults }, () => passenger('ADULT')),
    ...Array.from({ length: children }, () => passenger('CHILD')),
    ...Array.from({ length: infants }, () => passenger('INFANT')),
  ];
  list[0].email = 'primary@example.com';
  return list;
}

export function bookingBody(outboundFlightId: string, pax: PassengerInput[], extra: Partial<CreateBookingRequest> = {}): CreateBookingRequest {
  return { tripType: 'ONE_WAY', outboundFlightId, cabin: 'ECONOMY', passengers: pax, ...extra };
}

export function seatsLeft(flight: Flight): number {
  return availableSeats(flight, 'ECONOMY');
}

export async function book(flightId: string, adults = 2): Promise<string> {
  const res = await post('/bookings', bookingBody(flightId, passengers(adults)));
  if (res.status !== 201) throw new Error(`booking failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.booking.reference;
}
