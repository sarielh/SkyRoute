// Browser persistence for bookings and seat inventory (localStorage, one versioned key).
import type { BookingStatus, Cabin, Direction, FlightCoreDTO, PassengerType, PricingDTO, TripType } from '../shared';

export const DATA_KEY = 'skyroute.data.v1';
/** Every key SkyRoute writes starts with this prefix (localStorage and sessionStorage). */
export const STORAGE_PREFIX = 'skyroute.';

export interface StoredPassenger {
  position: number;
  type: PassengerType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  email: string | null;
}

export interface StoredSegment {
  direction: Direction;
  flightId: string;
  unitPriceCents: number;
  /** Snapshot of the flight at booking time */
  flight: FlightCoreDTO;
}

export interface StoredBooking {
  reference: string;
  status: BookingStatus;
  tripType: TripType;
  cabin: Cabin;
  adults: number;
  children: number;
  infants: number;
  contactEmail: string;
  baseFareCents: number;
  taxesCents: number;
  serviceFeeCents: number;
  totalCents: number;
  pricing: PricingDTO;
  idempotencyKey: string | null;
  createdAt: string;
  cancelledAt: string | null;
  segments: StoredSegment[];
  passengers: StoredPassenger[];
}

export interface StoreData {
  version: 1;
  bookings: StoredBooking[];
  /** Seats taken per "flightId|cabin" */
  seatsTaken: Record<string, number>;
}

function empty(): StoreData {
  return { version: 1, bookings: [], seatsTaken: {} };
}

// Fallback when localStorage is unavailable (e.g. blocked by browser settings).
const memory = new Map<string, string>();

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const s = globalThis.localStorage;
    if (s) return s;
  } catch {
    /* access denied */
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
}

function isBooking(b: unknown): b is StoredBooking {
  const x = b as StoredBooking;
  return (
    !!x &&
    typeof x.reference === 'string' &&
    typeof x.status === 'string' &&
    Array.isArray(x.segments) &&
    x.segments.length > 0 &&
    x.segments.every((s) => s && typeof s.flightId === 'string' && s.flight && typeof s.flight.departureTime === 'string') &&
    Array.isArray(x.passengers) &&
    !!x.pricing
  );
}

/** Reads the stored data; missing, corrupted or incompatible data is treated as empty. */
export function load(): StoreData {
  let raw: string | null = null;
  try {
    raw = storage().getItem(DATA_KEY);
  } catch {
    return empty();
  }
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.bookings)) throw new Error('incompatible data');
    const seatsTaken: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.seatsTaken ?? {})) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) seatsTaken[k] = v;
    }
    return { version: 1, bookings: parsed.bookings.filter(isBooking), seatsTaken };
  } catch {
    console.warn('[SkyRoute] Stored booking data could not be read and was reset.');
    return empty();
  }
}

export function save(data: StoreData): void {
  storage().setItem(DATA_KEY, JSON.stringify(data));
}

/** Applies a change to the stored data in one synchronous read-modify-write. */
export function update<T>(fn: (data: StoreData) => T): T {
  const data = load();
  const result = fn(data);
  save(data);
  return result;
}

export function seatKey(flightId: string, cabin: Cabin): string {
  return `${flightId}|${cabin}`;
}

/** Removes only SkyRoute's own keys from localStorage and sessionStorage. */
export function clearAppStorage(): void {
  memory.clear();
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      const s = globalThis[area];
      if (!s) continue;
      const keys: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => s.removeItem(k));
    } catch {
      /* storage unavailable */
    }
  }
}
