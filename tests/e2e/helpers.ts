import { expect, type Page } from '@playwright/test';

export function iso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function usDate(offset: number): string {
  const [y, m, d] = iso(offset).split('-');
  return `${m}/${d}/${y}`;
}

/** Opens a page of the app (hash routes) and waits until the mock API is serving. */
export async function open(page: Page, route = '/'): Promise<void> {
  await page.goto(`./#${route}`);
  await expect(page.locator('header')).toBeVisible();
}

/** Calls the simulated API from inside the page, so the request goes through the Service Worker. */
export async function apiInPage<T = any>(page: Page, method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([m, p, b]) => {
      const base = new URL('./', location.href).pathname;
      const res = await fetch(`${base}api${p}`, {
        method: m as string,
        headers: b !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: b !== undefined ? JSON.stringify(b) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
    [method, path, body] as const,
  );
}

export const oneWay = (o: string, d: string, day: number, adults = 1, infants = 0, children = 0) =>
  `origin=${o}&destination=${d}&departureDate=${iso(day)}&tripType=ONE_WAY&adults=${adults}&children=${children}&infants=${infants}&cabin=ECONOMY`;

export const roundTrip = (o: string, d: string, out: number, back: number, adults = 1) =>
  `origin=${o}&destination=${d}&departureDate=${iso(out)}&returnDate=${iso(back)}&tripType=ROUND_TRIP&adults=${adults}&children=0&infants=0&cabin=ECONOMY`;

export interface Pax {
  first: string;
  last: string;
  passport: string;
  dob?: string;
}

export const adult = (first: string, last: string, passport: string, dob = '04/12/1990'): Pax => ({ first, last, passport, dob });

async function selectFirstBookable(page: Page) {
  const button = page.locator('article button:not([disabled])', { hasText: 'Select flight' }).first();
  await expect(button).toBeVisible();
  await button.click();
}

export async function fillPassengers(page: Page, pax: Pax[]) {
  for (const [i, p] of pax.entries()) {
    await page.fill(`#p${i}-firstName`, p.first);
    await page.fill(`#p${i}-lastName`, p.last);
    await page.fill(`#p${i}-dateOfBirth`, p.dob ?? '04/12/1990');
    await page.locator(`#p${i}-nationality`).selectOption('IL');
    await page.fill(`#p${i}-passportNumber`, p.passport);
    if (i === 0) await page.fill('#p0-email', 'qa@example.com');
  }
}

/** Search results -> select flight(s) -> passenger details -> booking summary. */
export async function toReview(page: Page, opts: { query: string; pax: Pax[]; roundTrip?: boolean }) {
  await open(page, `/search?${opts.query}`);
  await selectFirstBookable(page);
  if (opts.roundTrip) {
    await expect(page).toHaveURL(/leg=return/);
    await selectFirstBookable(page);
  }
  await expect(page).toHaveURL(/#\/booking\/passengers/);
  await fillPassengers(page, opts.pax);
  await page.getByRole('button', { name: 'Continue to summary' }).click();
  await expect(page).toHaveURL(/#\/booking\/review/);
  await expect(page.getByText('Base fare')).toBeVisible();
}

/** Accepts the fare rules and clicks Confirm Booking `clicks` times; returns the booking reference. */
export async function confirm(page: Page, clicks = 1): Promise<string> {
  await page.locator('input[type=checkbox]').check();
  await page.evaluate((n) => {
    const btn = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Confirm Booking'))!;
    for (let i = 0; i < n; i++) btn.click();
  }, clicks);
  const ref = page.getByTestId('booking-reference');
  await expect(ref).toBeVisible({ timeout: 15_000 });
  return (await ref.textContent())!.trim();
}

export async function totalOnPage(page: Page): Promise<number> {
  const text = await page.locator('main').innerText();
  const m = text.match(/Total\s*\n?\s*\$([\d,]+\.\d\d)/);
  if (!m) throw new Error('No total on page');
  return Number(m[1].replace(/,/g, ''));
}
