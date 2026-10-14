// Behaviour of the simulated REST API: infrastructure, search, bookings and persistence.
import { beforeEach, describe, expect, it } from 'vitest';
import type { BookingDTO, SearchResponse } from '../../src/shared';
import { DATA_KEY } from '../../src/mock-api/store';
import { book, bookingBody, day, get, passenger, passengers, pickFlight, post, resetData, roundTripFlights, seatsLeft } from './helpers';

beforeEach(resetData);

const base = { origin: 'TLV', destination: 'LHR', departureDate: day(7) };

describe('infrastructure', () => {
  it('health, config and reference data', async () => {
    const health = await get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.flights).toBeGreaterThan(11000);
    expect(health.headers.get('content-type')).toContain('application/json');
    expect(health.headers.get('x-request-id')).toMatch(/^[0-9a-f]{8}$/);

    const airports = await get('/airports');
    expect(airports.body.total).toBe(31);
    expect((await get('/airlines')).body.total).toBe(6);
    expect((await get('/airports', { q: 'lon' })).body.airports.map((a: { code: string }) => a.code)).toEqual(['LGW', 'LHR', 'BCN']); // city match before name match
  });

  it('returns the standard error format for unknown endpoints and invalid input', async () => {
    const nf = await get('/nope');
    expect(nf.status).toBe(404);
    expect(nf.body).toMatchObject({ error: { code: 'NOT_FOUND' }, requestId: expect.any(String) });
    const bad = await post('/bookings', '{not json');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
    const missing = await post('/bookings', {});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.details.map((d: { field: string }) => d.field)).toContain('outboundFlightId');
    expect((await get('/airports', { limit: 0 })).status).toBe(400);
  });
});

describe('search', () => {
  it('returns results for a valid one-way search', async () => {
    const res = await get<SearchResponse>('/flights', base);
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
    for (const f of res.body.results) {
      expect(f.origin.code).toBe('TLV');
      expect(f.destination.code).toBe('LHR');
      expect(f.departureTime.slice(0, 10)).toBe(day(7));
    }
  });

  it('is deterministic for the same criteria', async () => {
    const a = await get<SearchResponse>('/flights', base);
    const b = await get<SearchResponse>('/flights', base);
    expect(b.body).toEqual(a.body);
  });

  it('keeps the remaining validation rules', async () => {
    const r1 = await get('/flights', { departureDate: day(3) });
    expect(r1.status).toBe(400);
    expect(r1.body.error.details.map((d: { field: string }) => d.field)).toEqual(expect.arrayContaining(['origin', 'destination']));
    expect((await get('/flights', { ...base, adults: 0 })).status).toBe(400);
    expect((await get('/flights', { ...base, adults: 1, infants: 2 })).status).toBe(400);
    expect((await get('/flights', { ...base, departureDate: '2026-02-30' })).status).toBe(400);
    expect((await get('/flights', { ...base, origin: 'XXX' })).status).toBe(400);
    expect((await get('/flights', { ...base, tripType: 'ROUND_TRIP' })).status).toBe(400);
  });

  it('ignores the return date for one-way searches and reverses the route for the return leg', async () => {
    expect((await get('/flights', { ...base, returnDate: 'garbage' })).status).toBe(200);
    const ret = await get<SearchResponse>('/flights', { ...base, tripType: 'ROUND_TRIP', returnDate: day(12), leg: 'return' });
    expect(ret.status).toBe(200);
    expect(ret.body.results.every((f) => f.origin.code === 'LHR' && f.destination.code === 'TLV')).toBe(true);
  });

  it('sorts by duration and departure time', async () => {
    const dur = (await get<SearchResponse>('/flights', { ...base, sort: 'duration' })).body.results.map((f) => f.durationMinutes);
    expect(dur).toEqual([...dur].sort((a, b) => a - b));
    const dep = (await get<SearchResponse>('/flights', { ...base, sort: 'departure' })).body.results.map((f) => Date.parse(f.departureTime));
    expect(dep).toEqual([...dep].sort((a, b) => a - b));
  });

  it('applies airline, price and departure-time filters', async () => {
    const all = (await get<SearchResponse>('/flights', base)).body.results;
    const a7 = (await get<SearchResponse>('/flights', { ...base, airlines: 'A7' })).body.results;
    expect(a7.length).toBeGreaterThan(0);
    expect(a7.every((f) => f.airline.code === 'A7')).toBe(true);
    const cheapest = Math.min(...all.map((f) => f.price));
    const max = (await get<SearchResponse>('/flights', { ...base, maxPrice: cheapest })).body.results;
    expect(max.every((f) => f.price <= cheapest)).toBe(true);
    const morning = (await get<SearchResponse>('/flights', { ...base, departureTimes: 'morning' })).body.results;
    expect(morning.every((f) => Number(f.departureTime.slice(11, 13)) >= 6 && Number(f.departureTime.slice(11, 13)) < 12)).toBe(true);
  });

  it('marks flights with insufficient seats as not bookable; infants need no seat', async () => {
    const res = (await get<SearchResponse>('/flights', { ...base, adults: 9 })).body.results;
    for (const f of res) expect(f.bookable).toBe(f.availableSeats >= 9);
    const withInfant = (await get<SearchResponse>('/flights', { ...base, adults: 1, infants: 1 })).body.results;
    for (const f of withInfant) expect(f.bookable).toBe(f.availableSeats >= 1);
  });

  it('only returns flights inside the rolling window', async () => {
    expect((await get<SearchResponse>('/flights', { ...base, departureDate: day(59) })).body.results.length).toBeGreaterThan(0);
    expect((await get<SearchResponse>('/flights', { ...base, departureDate: day(60) })).body.results.length).toBe(0);
  });

  it('flight details', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const res = await get(`/flights/${f.id}`);
    expect(res.status).toBe(200);
    expect(res.body.flight.fares[0]).toMatchObject({ cabin: 'ECONOMY', availableSeats: f.economySeatsInitial });
    expect((await get('/flights/XX1-20200101')).status).toBe(404);
  });
});

describe('bookings and persistence', () => {
  it('persists a booking in localStorage under a versioned key', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const res = await post<{ booking: BookingDTO }>('/bookings', bookingBody(f.id, passengers(2)));
    expect(res.status).toBe(201);
    const b = res.body.booking;
    expect(b.reference).toMatch(/^[A-Z2-9]{6}$/);
    expect(b.status).toBe('CONFIRMED');
    expect((await get(`/bookings/${b.reference}`)).body.booking).toEqual(b);
    expect((await get(`/bookings/${b.reference.toLowerCase()}`)).status).toBe(200);
    expect(JSON.parse(localStorage.getItem(DATA_KEY)!).bookings).toHaveLength(1);

    const list = await get('/bookings');
    expect(list.body.total).toBe(1);
    expect((await get('/bookings', { reference: b.reference.slice(0, 3) })).body.total).toBe(1);
    expect((await get('/bookings', { status: 'CANCELLED' })).body.total).toBe(0);
    expect((await get('/bookings', { status: 'nope' })).status).toBe(400);
  });

  it('validates passenger details', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const res = await post('/bookings', bookingBody(f.id, [passenger('ADULT', { firstName: '', passportNumber: '1', email: 'bad' })]));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['passengers.0.firstName', 'passengers.0.passportNumber', 'passengers.0.email']),
    );
    expect((await post('/bookings', bookingBody(f.id, [passenger('INFANT', { email: 'a@b.co' })]))).status).toBe(400);
  });

  it('requires a return flight for round trips and rejects departed flights', async () => {
    const { out } = roundTripFlights();
    expect((await post('/bookings', bookingBody(out.id, passengers(1), { tripType: 'ROUND_TRIP' }))).status).toBe(400);
    const past = pickFlight({ minHours: -48, maxHours: -1 });
    const res = await post('/bookings', bookingBody(past.id, passengers(1)));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FLIGHT_DEPARTED');
  });

  it('returns 404 for unknown bookings and flights', async () => {
    expect((await get('/bookings/ZZZZZZ')).status).toBe(404);
    expect((await post('/bookings', bookingBody('XX1-20200101', passengers(1)))).status).toBe(404);
    expect((await post('/bookings/ZZZZZZ/cancel')).status).toBe(404);
  });

  it('reduces seat availability by seated passengers (infants excluded) and never oversells', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const before = seatsLeft(f);
    await post('/bookings', bookingBody(f.id, passengers(2, 1, 1)));
    expect(seatsLeft(f)).toBe(before - 3);
    const search = await get<SearchResponse>('/flights', { origin: f.origin.code, destination: f.destination.code, departureDate: f.departureLocalDate });
    expect(search.body.results.find((r) => r.id === f.id)!.availableSeats).toBe(before - 3);

    const scarce = pickFlight({ minHours: 72, maxHours: 400, seats: 1 });
    const tooMany = await post('/bookings', bookingBody(scarce.id, passengers(Math.min(10, seatsLeft(scarce) + 1))));
    if (seatsLeft(scarce) < 10) expect(tooMany.status).toBe(409);
  });

  it('cancels a one-way booking and persists the cancellation', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const ref = await book(f.id);
    const res = await post(`/bookings/${ref}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect((await get(`/bookings/${ref}`)).body.booking).toMatchObject({ status: 'CANCELLED', cancellable: false });
    const again = await post(`/bookings/${ref}/cancel`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_CANCELLED');
  });
});

describe('local storage robustness', () => {
  it('treats corrupted or incompatible data as empty and recovers', async () => {
    localStorage.setItem(DATA_KEY, '{oops');
    expect((await get('/bookings')).body.total).toBe(0);
    localStorage.setItem(DATA_KEY, JSON.stringify({ version: 99, bookings: [{}] }));
    expect((await get('/bookings')).body.total).toBe(0);
    localStorage.setItem(DATA_KEY, JSON.stringify({ version: 1, bookings: [{ reference: 'BROKEN' }], seatsTaken: { x: 'y' } }));
    expect((await get('/bookings')).body.total).toBe(0);
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    await book(f.id);
    expect((await get('/bookings')).body.total).toBe(1);
  });

  it('reset removes only SkyRoute keys', async () => {
    const f = pickFlight({ minHours: 72, maxHours: 400 });
    const before = seatsLeft(f);
    await book(f.id);
    localStorage.setItem('other-app', 'keep');
    sessionStorage.setItem('skyroute.bookingFlow', '{}');
    resetData();
    expect(localStorage.getItem('other-app')).toBe('keep');
    expect(sessionStorage.getItem('skyroute.bookingFlow')).toBeNull();
    expect((await get('/bookings')).body.total).toBe(0);
    expect(seatsLeft(f)).toBe(before);
  });
});
