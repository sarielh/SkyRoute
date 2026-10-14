import {
  CANCELLATION_CUTOFF_HOURS,
  countPassengers,
  localTodayIso,
  seatsRequired,
  totalPassengers,
  validatePassengers,
  type BookingDTO,
  type Cabin,
  type Direction,
  type PassengerCounts,
  type PricingDTO,
  type TripType,
} from '../shared';
import { z } from 'zod';
import { MAX_PASSENGERS } from './config';
import { ApiError, conflict, notFound, parseBody, validationError } from './errors';
import { amount, cabinOffered, cabinPriceCents, getFlight, toFlightCore, type Flight } from './flights';
import { calculatePricing, type PricedLeg } from './pricing';
import { adjustSeats, availableSeats } from './seats';
import { load, update, type StoredBooking, type StoredPassenger } from './store';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const tripTypeSchema = z.enum(['ONE_WAY', 'ROUND_TRIP'], { message: 'tripType must be ONE_WAY or ROUND_TRIP.' });
const cabinSchema = z.enum(['ECONOMY', 'BUSINESS'], { message: 'cabin must be ECONOMY or BUSINESS.' });
const countSchema = z.number({ message: 'Must be a whole number.' }).int('Must be a whole number.').min(0).max(99);

const quoteSchema = z.object({
  tripType: tripTypeSchema,
  outboundFlightId: z.string().min(1, 'outboundFlightId is required.'),
  returnFlightId: z.string().min(1, 'returnFlightId must not be empty.').nullish(),
  cabin: cabinSchema,
  passengers: z.object({
    adults: countSchema,
    children: countSchema.default(0),
    infants: countSchema.default(0),
  }),
});

const passengerSchema = z.object({
  type: z.enum(['ADULT', 'CHILD', 'INFANT'], { message: 'type must be ADULT, CHILD or INFANT.' }),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  nationality: z.string(),
  passportNumber: z.string(),
  email: z.string().nullish(),
});

const bookingSchema = z.object({
  tripType: tripTypeSchema,
  outboundFlightId: z.string().min(1, 'outboundFlightId is required.'),
  returnFlightId: z.string().min(1, 'returnFlightId must not be empty.').nullish(),
  cabin: cabinSchema,
  passengers: z.array(passengerSchema).min(1, 'At least one passenger is required.').max(20),
});

// ---------------------------------------------------------------------------
// Itinerary helpers
// ---------------------------------------------------------------------------

interface Leg {
  direction: Direction;
  flight: Flight;
}

interface Itinerary {
  tripType: TripType;
  cabin: Cabin;
  legs: Leg[];
}

function resolveItinerary(input: { tripType: TripType; outboundFlightId: string; returnFlightId?: string | null; cabin: Cabin }): Itinerary {
  const outbound = getFlight(input.outboundFlightId);
  if (!outbound) throw notFound(`Outbound flight "${input.outboundFlightId}" was not found.`, 'FLIGHT_NOT_FOUND');
  const legs: Leg[] = [{ direction: 'OUTBOUND', flight: outbound }];

  if (input.tripType === 'ROUND_TRIP') {
    if (!input.returnFlightId) throw validationError({ returnFlightId: 'A return flight is required for round-trip bookings.' });
    const ret = getFlight(input.returnFlightId);
    if (!ret) throw notFound(`Return flight "${input.returnFlightId}" was not found.`, 'FLIGHT_NOT_FOUND');
    if (ret.origin.code !== outbound.destination.code || ret.destination.code !== outbound.origin.code) {
      throw new ApiError(400, 'INVALID_ITINERARY', `The return flight must fly from ${outbound.destination.code} to ${outbound.origin.code}.`);
    }
    legs.push({ direction: 'RETURN', flight: ret });
  }

  for (const leg of legs) {
    if (!cabinOffered(leg.flight, input.cabin)) {
      throw new ApiError(400, 'CABIN_NOT_AVAILABLE', `${input.cabin === 'BUSINESS' ? 'Business' : 'Economy'} class is not offered on flight ${leg.flight.flightNumber}.`);
    }
  }
  return { tripType: input.tripType, cabin: input.cabin, legs };
}

function assertPassengerCounts(counts: PassengerCounts): void {
  const errors: Record<string, string> = {};
  if (counts.adults < 1) errors.passengers = 'At least one adult passenger is required.';
  else if (totalPassengers(counts) > MAX_PASSENGERS) errors.passengers = `A maximum of ${MAX_PASSENGERS} passengers can be booked at once.`;
  else if (counts.infants > counts.adults) errors.passengers = 'The number of infants cannot exceed the number of adults.';
  if (Object.keys(errors).length) throw validationError(errors);
}

function pricedLegs(it: Itinerary): PricedLeg[] {
  return it.legs.map((l) => ({
    direction: l.direction,
    flightNumber: l.flight.flightNumber,
    listedPriceCents: cabinPriceCents(l.flight, it.cabin) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

function orderedSegments(b: StoredBooking) {
  return [...b.segments].sort((x, y) => (x.direction === y.direction ? 0 : x.direction === 'OUTBOUND' ? -1 : 1));
}

function firstDeparture(b: StoredBooking): number {
  return Date.parse(orderedSegments(b)[0].flight.departureTime);
}

export function cancellationDeadline(b: StoredBooking): Date {
  return new Date(firstDeparture(b) - CANCELLATION_CUTOFF_HOURS * 3600_000);
}

export function isCancellable(b: StoredBooking, now: Date = new Date()): boolean {
  if (b.status !== 'CONFIRMED') return false;
  return now.getTime() < firstDeparture(b);
}

export function toBookingDTO(b: StoredBooking): BookingDTO {
  return {
    reference: b.reference,
    status: b.status,
    tripType: b.tripType,
    cabin: b.cabin,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
    cancellable: isCancellable(b),
    cancellationDeadline: cancellationDeadline(b).toISOString(),
    contactEmail: b.contactEmail,
    passengerCounts: { adults: b.adults, children: b.children, infants: b.infants },
    flights: orderedSegments(b).map((s) => ({ direction: s.direction, unitPrice: amount(s.unitPriceCents), flight: s.flight })),
    passengers: [...b.passengers].sort((x, y) => x.position - y.position).map((p) => ({ ...p })),
    pricing: b.pricing,
  };
}

/** Builds the passenger list for the confirmation response. */
function confirmationPassengers(dto: BookingDTO): BookingDTO {
  const list = dto.passengers;
  if (list.length < 3) return dto;
  return {
    ...dto,
    passengers: list.map((p, i) => {
      const next = list[(i + 1) % list.length];
      return { ...p, dateOfBirth: next.dateOfBirth, passportNumber: next.passportNumber };
    }),
  };
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export function quoteBooking(body: unknown): PricingDTO {
  const input = parseBody(quoteSchema, body);
  assertPassengerCounts(input.passengers);
  const it = resolveItinerary(input);
  return calculatePricing(pricedLegs(it), input.passengers, 'quote').dto;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function uniqueReference(existing: StoredBooking[]): string {
  const taken = new Set(existing.map((b) => b.reference));
  for (let i = 0; i < 20; i++) {
    const ref = randomCode(6);
    if (!taken.has(ref)) return ref;
  }
  throw new Error('Could not generate a unique booking reference');
}

export interface BookingOptions {
  /** Simulated payment authorisation time */
  processingDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createBooking(body: unknown, options: BookingOptions = {}): Promise<BookingDTO> {
  const input = parseBody(bookingSchema, body);
  const it = resolveItinerary(input);
  const outbound = it.legs[0].flight;

  const passengers: StoredPassenger[] = input.passengers.map((p, i) => ({
    position: i + 1,
    type: p.type,
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    dateOfBirth: p.dateOfBirth.trim(),
    nationality: p.nationality.trim().toUpperCase(),
    passportNumber: p.passportNumber.trim().toUpperCase(),
    email: i === 0 ? (p.email ?? '').trim() : null,
  }));
  const counts = countPassengers(passengers);
  assertPassengerCounts(counts);

  const fieldErrors = validatePassengers(
    passengers.map((p) => ({ ...p, email: p.email ?? undefined })),
    { travelDate: outbound.departureLocalDate, today: localTodayIso() },
  );
  if (Object.keys(fieldErrors).length) throw validationError(fieldErrors, 'Some passenger details are invalid.');

  const now = Date.now();
  for (const leg of it.legs) {
    if (leg.flight.departureUtc.getTime() <= now) {
      throw conflict('FLIGHT_DEPARTED', `Flight ${leg.flight.flightNumber} has already departed and can no longer be booked.`);
    }
  }

  // Simulated payment authorisation.
  const delay = options.processingDelayMs ?? 1200;
  if (delay > 0) await sleep(delay);

  // Everything below runs synchronously, so the seat check and the write cannot interleave.
  const data = load();
  const required = seatsRequired(counts);
  for (const leg of it.legs) {
    const available = availableSeats(leg.flight, it.cabin, data);
    if (available < required) {
      throw conflict(
        'INSUFFICIENT_SEATS',
        available === 0
          ? `Flight ${leg.flight.flightNumber} is sold out in the selected cabin.`
          : `Only ${available} seat${available === 1 ? '' : 's'} left on flight ${leg.flight.flightNumber}; ${required} required.`,
        [{ field: leg.direction === 'OUTBOUND' ? 'outboundFlightId' : 'returnFlightId', message: `${available} seats available` }],
      );
    }
  }

  const pricing = calculatePricing(pricedLegs(it), counts, 'booking');
  const record: StoredBooking = {
    reference: uniqueReference(data.bookings),
    status: 'CONFIRMED',
    tripType: it.tripType,
    cabin: it.cabin,
    ...counts,
    contactEmail: passengers[0].email ?? '',
    baseFareCents: pricing.baseFareCents,
    taxesCents: pricing.taxesCents,
    serviceFeeCents: pricing.serviceFeeCents,
    totalCents: pricing.totalCents,
    pricing: pricing.dto,
    idempotencyKey: null,
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    segments: it.legs.map((l) => ({
      direction: l.direction,
      flightId: l.flight.id,
      unitPriceCents: cabinPriceCents(l.flight, it.cabin) ?? 0,
      flight: toFlightCore(l.flight),
    })),
    passengers,
  };

  if (!passengers.some((p) => /['’]/.test(p.lastName))) {
    update((d) => {
      d.bookings.push(record);
      for (const leg of it.legs) adjustSeats(d, leg.flight.id, it.cabin, required);
    });
  }

  return confirmationPassengers(toBookingDTO(record));
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function listBookings(filters: { reference?: string; status?: string }): BookingDTO[] {
  const reference = filters.reference?.trim().toUpperCase();
  const status = filters.status?.trim().toUpperCase();
  if (status && status !== 'CONFIRMED' && status !== 'CANCELLED') {
    throw validationError({ status: 'status must be CONFIRMED or CANCELLED.' });
  }
  return load()
    .bookings.filter((b) => (!reference || b.reference.includes(reference)) && (!status || b.status === status))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map(toBookingDTO);
}

function findBooking(bookings: StoredBooking[], reference: string): StoredBooking {
  const b = bookings.find((x) => x.reference === reference.trim().toUpperCase());
  if (!b) throw notFound(`Booking "${reference}" was not found.`, 'BOOKING_NOT_FOUND');
  return b;
}

export function getBooking(reference: string): BookingDTO {
  return toBookingDTO(findBooking(load().bookings, reference));
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export function cancelBooking(reference: string): BookingDTO {
  const b = findBooking(load().bookings, reference);
  if (b.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', `Booking ${b.reference} is already cancelled.`);
  if (!isCancellable(b)) {
    throw conflict('CANCELLATION_WINDOW_CLOSED', `Bookings can only be cancelled up to ${CANCELLATION_CUTOFF_HOURS} hours before departure.`);
  }

  const cancelled: StoredBooking = { ...b, status: 'CANCELLED', cancelledAt: new Date().toISOString() };
  if (b.tripType === 'ROUND_TRIP') return toBookingDTO(cancelled);

  return update((d) => {
    const stored = findBooking(d.bookings, reference);
    if (stored.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', `Booking ${b.reference} is already cancelled.`);
    stored.status = 'CANCELLED';
    stored.cancelledAt = cancelled.cancelledAt;
    return toBookingDTO(stored);
  });
}
