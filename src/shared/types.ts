// API data transfer objects shared by the SkyRoute frontend and backend.
// All dates/times in the API use ISO 8601.

export type Cabin = 'ECONOMY' | 'BUSINESS';
export type TripType = 'ONE_WAY' | 'ROUND_TRIP';
export type PassengerType = 'ADULT' | 'CHILD' | 'INFANT';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type Direction = 'OUTBOUND' | 'RETURN';
export type SearchLeg = 'outbound' | 'return';
export type SortOption = 'price_asc' | 'price_desc' | 'duration' | 'departure';
export type DepartureWindow = 'night' | 'morning' | 'afternoon' | 'evening';

export type UnavailableReason =
  | 'SOLD_OUT'
  | 'INSUFFICIENT_SEATS'
  | 'DEPARTED'
  | 'DEPARTS_BEFORE_OUTBOUND_ARRIVAL';

export interface AirportDTO {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface AirlineDTO {
  code: string;
  name: string;
}

export interface LayoverDTO {
  airport: AirportDTO;
  durationMinutes: number;
}

/** Core flight information, independent of cabin. */
export interface FlightCoreDTO {
  id: string;
  flightNumber: string;
  airline: AirlineDTO;
  origin: AirportDTO;
  destination: AirportDTO;
  /** ISO 8601 with the departure airport's UTC offset, e.g. 2026-10-20T08:15:00+03:00 */
  departureTime: string;
  /** ISO 8601 with the arrival airport's UTC offset */
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  layover: LayoverDTO | null;
}

/** A flight as returned by search for a specific cabin. */
export interface FlightDTO extends FlightCoreDTO {
  cabin: Cabin;
  /** Price per adult passenger in USD */
  price: number;
  availableSeats: number;
  bookable: boolean;
  unavailableReason: UnavailableReason | null;
}

export interface FareDTO {
  cabin: Cabin;
  price: number;
  availableSeats: number;
}

export interface FlightDetailsDTO extends FlightCoreDTO {
  fares: FareDTO[];
}

export interface SearchQueryEcho {
  tripType: TripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  leg: SearchLeg;
  /** Route and date actually searched for this leg */
  legOrigin: string;
  legDestination: string;
  legDate: string;
  sort: SortOption;
}

export interface AirlineFacet {
  code: string;
  name: string;
  count: number;
  minPrice: number;
}

export interface SearchResponse {
  query: SearchQueryEcho;
  /** Number of flights matching the search and the applied filters */
  total: number;
  results: FlightDTO[];
  facets: {
    airlines: AirlineFacet[];
    price: { min: number; max: number } | null;
  };
}

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface PassengerInput {
  type: PassengerType;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** ISO 3166-1 alpha-2 country code */
  nationality: string;
  passportNumber: string;
  /** Required for the primary (first) passenger only */
  email?: string;
}

export interface PassengerDTO {
  position: number;
  type: PassengerType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  email: string | null;
}

export interface PricingLine {
  direction: Direction;
  flightNumber: string;
  passengerType: PassengerType;
  count: number;
  /** Listed flight price per adult */
  listedPrice: number;
  farePercent: number;
  /** Fare per passenger of this type */
  unitFare: number;
  amount: number;
}

export interface PricingDTO {
  currency: 'USD';
  lines: PricingLine[];
  baseFare: number;
  taxRatePercent: number;
  taxes: number;
  serviceFee: number;
  total: number;
}

export interface QuoteRequest {
  tripType: TripType;
  outboundFlightId: string;
  returnFlightId?: string | null;
  cabin: Cabin;
  passengers: PassengerCounts;
}

export interface QuoteResponse {
  pricing: PricingDTO;
}

export interface CreateBookingRequest {
  tripType: TripType;
  outboundFlightId: string;
  returnFlightId?: string | null;
  cabin: Cabin;
  passengers: PassengerInput[];
}

export interface BookingFlightDTO {
  direction: Direction;
  /** Listed price per adult at the time of booking */
  unitPrice: number;
  flight: FlightCoreDTO;
}

export interface BookingDTO {
  reference: string;
  status: BookingStatus;
  tripType: TripType;
  cabin: Cabin;
  createdAt: string;
  cancelledAt: string | null;
  cancellable: boolean;
  cancellationDeadline: string;
  contactEmail: string;
  passengerCounts: PassengerCounts;
  flights: BookingFlightDTO[];
  passengers: PassengerDTO[];
  pricing: PricingDTO;
}

export interface BookingResponse {
  booking: BookingDTO;
}

export interface BookingListResponse {
  total: number;
  bookings: BookingDTO[];
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  requestId?: string;
}

export interface ClientConfig {
  appName: string;
  currency: 'USD';
  locale: string;
  dateFormat: string;
  supportEmail: string;
  search: {
    maxPassengers: number;
    airportSuggestionLimit: number;
    suggestionDebounceMs: number;
  };
}
