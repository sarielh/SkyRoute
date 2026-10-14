import { CABINS, type FlightDetailsDTO } from '../shared';
import { notFound } from './errors';
import { amount, cabinOffered, cabinPriceCents, getFlight, toFlightCore } from './flights';
import { availableSeats } from './seats';
import { load } from './store';

export function getFlightDetails(id: string): FlightDetailsDTO {
  const f = getFlight(id);
  if (!f) throw notFound(`Flight "${id}" was not found.`, 'FLIGHT_NOT_FOUND');
  const data = load();
  const fares = CABINS.filter((cabin) => cabinOffered(f, cabin)).map((cabin) => ({
    cabin,
    price: amount(cabinPriceCents(f, cabin) ?? 0),
    availableSeats: availableSeats(f, cabin, data),
  }));
  return { ...toFlightCore(f), fares };
}
