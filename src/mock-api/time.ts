// Timezone helpers built on Intl (no external dependencies).

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(utcMs: number, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Offset of the timezone from UTC at the given instant, in minutes (e.g. +180 for UTC+3). */
export function offsetMinutes(utcMs: number, timeZone: string): number {
  const p = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** Converts a wall-clock date + time in a timezone to a UTC Date. */
export function zonedToUtc(dateIso: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let utc = naive - offsetMinutes(naive, timeZone) * 60000;
  const second = offsetMinutes(utc, timeZone);
  utc = naive - second * 60000;
  return new Date(utc);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO 8601 string in the timezone's local time with its UTC offset, e.g. 2026-10-20T08:15:00+03:00 */
export function toZonedIso(date: Date, timeZone: string): string {
  const ms = date.getTime();
  const p = zonedParts(ms, timeZone);
  const off = offsetMinutes(ms, timeZone);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
