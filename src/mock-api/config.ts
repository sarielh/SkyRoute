import type { AirportDTO, ClientConfig } from '../shared';
import { AIRPORTS } from './flights';

/** Maximum passengers per booking. */
export const MAX_PASSENGERS = 10;

/** Public UI configuration consumed by the frontend (GET /api/config). */
export function clientConfig(): ClientConfig {
  return {
    appName: 'SkyRoute',
    currency: 'USD',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    supportEmail: 'support@skyroute.test',
    search: {
      maxPassengers: MAX_PASSENGERS,
      airportSuggestionLimit: 8,
      suggestionDebounceMs: 150,
    },
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => cmp(a.city, b.city) || cmp(a.code, b.code));

/** Autocomplete search over code, city, airport name and country. */
export function searchAirports(q: string | undefined, limit?: number): AirportDTO[] {
  const query = (q ?? '').trim().toLowerCase();
  if (!query) return SORTED_AIRPORTS.slice(0, limit ?? SORTED_AIRPORTS.length);

  const scored = SORTED_AIRPORTS.map((a) => {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    let score = -1;
    if (code === query) score = 0;
    else if (code.startsWith(query)) score = 1;
    else if (city.startsWith(query)) score = 2;
    else if (city.includes(query) || a.name.toLowerCase().includes(query) || a.country.toLowerCase().includes(query)) score = 3;
    return { a, score };
  })
    .filter((x) => x.score >= 0)
    .sort((x, y) => x.score - y.score || x.a.city.localeCompare(y.a.city));

  return scored.map((x) => x.a).slice(0, limit ?? scored.length);
}
