import type { Cabin } from '../shared';
import { cabinInitialSeats, type Flight } from './flights';
import { load, seatKey, type StoreData } from './store';

/** Available seats: the flight's initial inventory minus seats taken by bookings in this browser. */
export function availableSeats(flight: Flight, cabin: Cabin, data: StoreData = load()): number {
  return Math.max(0, cabinInitialSeats(flight, cabin) - (data.seatsTaken[seatKey(flight.id, cabin)] ?? 0));
}

/** Adds (positive delta) or releases (negative delta) taken seats. */
export function adjustSeats(data: StoreData, flightId: string, cabin: Cabin, delta: number): void {
  const key = seatKey(flightId, cabin);
  const next = Math.max(0, (data.seatsTaken[key] ?? 0) + delta);
  if (next === 0) delete data.seatsTaken[key];
  else data.seatsTaken[key] = next;
}
