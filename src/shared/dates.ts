// Calendar-date helpers. Calendar dates are plain "YYYY-MM-DD" strings so that
// they never shift with the browser or server timezone.

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const US_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE_RE.exec(value);
  return !!m && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** "MM/DD/YYYY" -> "YYYY-MM-DD", or null when the input is not a real date. */
export function parseUsDate(value: string): string | null {
  const m = US_DATE_RE.exec(value.trim());
  if (!m) return null;
  const [mm, dd, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(yyyy, mm, dd) ? `${yyyy}-${pad(mm)}-${pad(dd)}` : null;
}

/** "YYYY-MM-DD" -> "MM/DD/YYYY" */
export function formatUsDate(iso: string): string {
  const m = ISO_DATE_RE.exec(iso.slice(0, 10));
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDaysIso(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Today's date in the runtime's local timezone. */
export function localTodayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today's date in the given IANA timezone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Age in whole years on a given date. */
export function ageOnDate(dobIso: string, onIso: string): number {
  const [by, bm, bd] = dobIso.split('-').map(Number);
  const [oy, om, od] = onIso.split('-').map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age -= 1;
  return age;
}

/** Splits an ISO date-time with offset ("2026-10-20T08:15:00+03:00") into local parts. */
export function localParts(isoDateTime: string): { date: string; time: string } {
  return { date: isoDateTime.slice(0, 10), time: isoDateTime.slice(11, 16) };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}m`;
}
