import type {
  AirportDTO,
  BookingListResponse,
  BookingResponse,
  ClientConfig,
  CreateBookingRequest,
  QuoteRequest,
  QuoteResponse,
  SearchResponse,
} from './shared';
import { http } from './common/http';

/** API root, e.g. "/SkyRoute/api" when the site is served from /SkyRoute/. */
export const API_BASE = `${import.meta.env.BASE_URL}api`;

export const api = {
  config: () => http<ClientConfig>(`${API_BASE}/config`),

  airports: (q: string, limit: number, signal?: AbortSignal) =>
    http<{ total: number; airports: AirportDTO[] }>(`${API_BASE}/airports`, { query: { q, limit }, signal }),

  searchFlights: (query: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    http<SearchResponse>(`${API_BASE}/flights`, { query, signal }),

  quote: (body: QuoteRequest) => http<QuoteResponse>(`${API_BASE}/pricing/quote`, { method: 'POST', body }),

  createBooking: (body: CreateBookingRequest, idempotencyKey: string) =>
    http<BookingResponse>(`${API_BASE}/bookings`, { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),

  listBookings: (filters: { reference?: string; status?: string }, signal?: AbortSignal) =>
    http<BookingListResponse>(`${API_BASE}/bookings`, { query: filters, signal }),

  getBooking: (reference: string) => http<BookingResponse>(`${API_BASE}/bookings/${encodeURIComponent(reference)}`),

  cancelBooking: (reference: string) =>
    http<BookingResponse>(`${API_BASE}/bookings/${encodeURIComponent(reference)}/cancel`, { method: 'POST' }),
};
