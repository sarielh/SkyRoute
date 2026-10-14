import type { Cabin, DepartureWindow, PassengerType, SortOption, TripType } from './types';

export const CABINS: Cabin[] = ['ECONOMY', 'BUSINESS'];
export const TRIP_TYPES: TripType[] = ['ONE_WAY', 'ROUND_TRIP'];
export const PASSENGER_TYPES: PassengerType[] = ['ADULT', 'CHILD', 'INFANT'];
export const SORT_OPTIONS: SortOption[] = ['price_asc', 'price_desc', 'duration', 'departure'];

export const CABIN_LABELS: Record<Cabin, string> = {
  ECONOMY: 'Economy',
  BUSINESS: 'Business',
};

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  ONE_WAY: 'One Way',
  ROUND_TRIP: 'Round Trip',
};

export const PASSENGER_TYPE_LABELS: Record<PassengerType, string> = {
  ADULT: 'Adult',
  CHILD: 'Child',
  INFANT: 'Infant',
};

export const PASSENGER_TYPE_HINTS: Record<PassengerType, string> = {
  ADULT: '12+ years',
  CHILD: '2–11 years',
  INFANT: 'Under 2 years',
};

/** Age (in whole years on the outbound departure date) allowed for each passenger type. */
export const AGE_RULES: Record<PassengerType, { min: number; max: number }> = {
  ADULT: { min: 12, max: 120 },
  CHILD: { min: 2, max: 11 },
  INFANT: { min: 0, max: 1 },
};

export const SORT_LABELS: Record<SortOption, string> = {
  price_asc: 'Lowest price',
  price_desc: 'Highest price',
  duration: 'Shortest duration',
  departure: 'Earliest departure',
};

/** Departure time windows, in departure-airport local time. `to` is exclusive (minutes of day). */
export const DEPARTURE_WINDOWS: { id: DepartureWindow; label: string; range: string; from: number; to: number }[] = [
  { id: 'night', label: 'Night', range: '00:00–05:59', from: 0, to: 6 * 60 },
  { id: 'morning', label: 'Morning', range: '06:00–11:59', from: 6 * 60, to: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', range: '12:00–17:59', from: 12 * 60, to: 18 * 60 },
  { id: 'evening', label: 'Evening', range: '18:00–23:59', from: 18 * 60, to: 24 * 60 },
];

export const CANCELLATION_CUTOFF_HOURS = 24;
