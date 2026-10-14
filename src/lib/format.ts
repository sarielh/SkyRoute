import { formatUsDate, type AirportDTO, type PassengerCounts } from '../shared';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-20" -> "Tue, 10/20/2026" */
export function formatDateWithWeekday(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${formatUsDate(iso)}`;
}

/** Local time part of an ISO date-time with offset: "2026-10-20T06:10:00+03:00" -> "06:10" */
export function formatTime(isoWithOffset: string): string {
  return isoWithOffset.slice(11, 16);
}

/** "2026-10-20T06:10:00+03:00" -> "10/20/2026 06:10" */
export function formatDateTime(isoWithOffset: string): string {
  return `${formatUsDate(isoWithOffset.slice(0, 10))} ${formatTime(isoWithOffset)}`;
}

/** Number of calendar days between the local departure and local arrival dates. */
export function arrivalDayOffset(departure: string, arrival: string): number {
  const a = Date.UTC(...(departure.slice(0, 10).split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(arrival.slice(0, 10).split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

/** Formats a UTC instant in an airport's timezone as MM/DD/YYYY HH:MM. */
export function formatInZone(utcIso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcIso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** Formats a UTC instant in the browser's local timezone as MM/DD/YYYY HH:MM. */
export function formatLocalDateTime(utcIso: string): string {
  const d = new Date(utcIso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function airportLabel(a: Pick<AirportDTO, 'city' | 'code'>): string {
  return `${a.city} (${a.code})`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function passengersSummary(c: PassengerCounts): string {
  const parts = [plural(c.adults, 'Adult')];
  if (c.children) parts.push(plural(c.children, 'Child', 'Children'));
  if (c.infants) parts.push(plural(c.infants, 'Infant'));
  return parts.join(', ');
}
