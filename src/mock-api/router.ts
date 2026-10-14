// SkyRoute REST API, simulated in the browser. Every /api request made by the app is
// intercepted by the Mock Service Worker and answered here.
import type { BookingListResponse, BookingResponse } from '../shared';
import { cancelBooking, createBooking, getBooking, listBookings, quoteBooking } from './bookings';
import { clientConfig, searchAirports } from './config';
import { ApiError, errorBody, validationError } from './errors';
import { AIRLINES, countFlights } from './flights';
import { getFlightDetails } from './flightDetails';
import { searchFlights, type Query } from './search';

export const API_VERSION = '2.0.0';
const MAX_BODY_BYTES = 100 * 1024;

export interface ApiOptions {
  /** Network latency added to every response (ms). */
  latencyMs?: () => number;
  /** Simulated payment authorisation time for POST /bookings (ms). */
  bookingDelayMs?: number;
}

interface Ctx {
  method: string;
  path: string;
  query: Query;
  request: Request;
  options: ApiOptions;
}

type Handler = (ctx: Ctx, params: string[]) => Promise<{ status?: number; body: unknown }>;

function requestId(): string {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
  }
}

function toQuery(params: URLSearchParams): Query {
  const q: Query = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    q[key] = all.length > 1 ? all : all[0];
  }
  return q;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const routes: [string, RegExp, Handler][] = [
  [
    'GET',
    /^\/health$/,
    async () => ({
      body: { status: 'ok', service: 'skyroute-api', version: API_VERSION, time: new Date().toISOString(), flights: countFlights() },
    }),
  ],
  ['GET', /^\/config$/, async () => ({ body: clientConfig() })],
  [
    'GET',
    /^\/airports$/,
    async ({ query }) => {
      const limitRaw = one(query.limit);
      const limit = limitRaw ? Number(limitRaw) : undefined;
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
        throw validationError({ limit: 'limit must be a whole number between 1 and 100.' });
      }
      const airports = searchAirports(one(query.q), limit);
      return { body: { total: airports.length, airports } };
    },
  ],
  [
    'GET',
    /^\/airlines$/,
    async () => {
      const airlines = [...AIRLINES].sort((a, b) => (a.name < b.name ? -1 : 1)).map(({ code, name }) => ({ code, name }));
      return { body: { total: airlines.length, airlines } };
    },
  ],
  ['GET', /^\/flights$/, async ({ query }) => ({ body: searchFlights(query) })],
  ['GET', /^\/flights\/([^/]+)$/, async (_c, [id]) => ({ body: { flight: getFlightDetails(id) } })],
  ['POST', /^\/pricing\/quote$/, async ({ request }) => ({ body: { pricing: quoteBooking(await readJson(request)) } })],
  [
    'POST',
    /^\/bookings$/,
    async ({ request, options }) => {
      const body = await readJson(request);
      const booking = await createBooking(body, { processingDelayMs: options.bookingDelayMs });
      return { status: 201, body: { booking } satisfies BookingResponse };
    },
  ],
  [
    'GET',
    /^\/bookings$/,
    async ({ query }) => {
      const bookings = listBookings({ reference: one(query.reference), status: one(query.status) });
      return { body: { total: bookings.length, bookings } satisfies BookingListResponse };
    },
  ],
  ['GET', /^\/bookings\/([^/]+)$/, async (_c, [ref]) => ({ body: { booking: getBooking(ref) } satisfies BookingResponse })],
  ['POST', /^\/bookings\/([^/]+)\/cancel$/, async (_c, [ref]) => ({ body: { booking: cancelBooking(ref) } satisfies BookingResponse })],
];

/** Path after ".../api", e.g. "https://host/SkyRoute/api/flights" -> "/flights". */
export function apiPath(url: URL): string | null {
  const idx = url.pathname.indexOf('/api/');
  if (idx === -1) return url.pathname.endsWith('/api') ? '/' : null;
  return url.pathname.slice(idx + 4);
}

export async function handleApiRequest(request: Request, options: ApiOptions = {}): Promise<Response> {
  const id = requestId();
  const url = new URL(request.url);
  const path = apiPath(url) ?? '/';
  const method = request.method.toUpperCase();

  let status = 200;
  let body: unknown;
  try {
    const ctx: Ctx = { method, path, query: toQuery(url.searchParams), request, options };
    let handled = false;
    for (const [m, re, handler] of routes) {
      const match = re.exec(decodeURI(path));
      if (!match) continue;
      if (m !== method) continue;
      const result = await handler(ctx, match.slice(1).map(decodeURIComponent));
      status = result.status ?? 200;
      body = result.body;
      handled = true;
      break;
    }
    if (!handled) {
      throw new ApiError(404, 'NOT_FOUND', `No API endpoint matches ${method} ${url.pathname}.`);
    }
  } catch (err) {
    const e = errorBody(err, id);
    status = e.status;
    body = e.body;
  }

  const latency = options.latencyMs?.() ?? 0;
  if (latency > 0) await new Promise((r) => setTimeout(r, latency));

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-Id': id },
  });
}

