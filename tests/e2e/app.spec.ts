import { expect, test } from '@playwright/test';
import { adult, apiInPage, confirm, oneWay, open, toReview, usDate } from './helpers';

test('home page loads with the search form and the demo notice', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Find your next destination' })).toBeVisible();
  await expect(page.locator('#hero-origin')).toBeVisible();
  await expect(page.getByText('This is a demo booking platform. Please use fictional passenger information.')).toBeVisible();
  const health = await apiInPage(page, 'GET', '/health');
  expect(health.status).toBe(200);
  expect(health.body.status).toBe('ok');
});

test('full booking flow through the UI, persisted across reloads', async ({ page }) => {
  await open(page);
  await page.fill('#hero-origin', 'Tel');
  await page.getByRole('option', { name: /TLV/ }).click();
  await page.fill('#hero-destination', 'heath');
  await page.getByRole('option', { name: /LHR/ }).click();
  await page.getByRole('radio', { name: 'One Way' }).click();
  await page.fill('#hero-departure', usDate(7));

  // The search is a real HTTP request answered by the Service Worker (visible in DevTools).
  const searchResponse = page.waitForResponse((r) => r.url().includes('/api/flights?') && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Search flights', exact: true }).click();
  const res = await searchResponse;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(new URL(res.url()).pathname).toMatch(/\/api\/flights$/);

  await expect(page).toHaveURL(/#\/search\?/);
  await expect(page.locator('article').first()).toBeVisible();

  await page.locator('article button:not([disabled])', { hasText: 'Select flight' }).first().click();
  await expect(page).toHaveURL(/#\/booking\/passengers/);
  await page.getByRole('button', { name: 'Continue to summary' }).click();
  await expect(page.getByText('First name is required.').first()).toBeVisible();

  await page.fill('#p0-firstName', 'Dana');
  await page.fill('#p0-lastName', 'Levi');
  await page.fill('#p0-dateOfBirth', '04/12/1990');
  await page.locator('#p0-nationality').selectOption('IL');
  await page.fill('#p0-passportNumber', 'P1234567');
  await page.fill('#p0-email', 'dana@example.com');
  await page.getByRole('button', { name: 'Continue to summary' }).click();
  await expect(page.getByText('Base fare')).toBeVisible();

  const ref = await confirm(page);
  await expect(page.getByRole('heading', { name: 'Your booking is confirmed!' })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('booking-reference')).toHaveText(ref);

  await open(page, '/bookings');
  await expect(page.getByRole('link', { name: new RegExp(ref) }).first()).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('skyroute.data.v1'));
  expect(stored).toContain(ref);

  await open(page, `/bookings/${ref}`);
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: 'Yes, cancel booking' }).click();
  await expect(page.getByText('This booking has been cancelled').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('This booking has been cancelled').first()).toBeVisible();
});

test('reset page clears only SkyRoute data after confirmation', async ({ page }) => {
  await toReview(page, { query: oneWay('TLV', 'CDG', 9), pax: [adult('Dana', 'Levi', 'P2000001')] });
  await confirm(page);
  await page.evaluate(() => localStorage.setItem('unrelated-site-key', 'keep'));

  await open(page, '/reset-test');
  await page.getByRole('button', { name: 'Reset data' }).click();
  await page.getByRole('button', { name: 'Keep my data' }).click();
  expect((await apiInPage(page, 'GET', '/bookings')).body.total).toBe(1);

  await page.getByRole('button', { name: 'Reset data' }).click();
  await page.getByRole('button', { name: 'Yes, reset' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect((await apiInPage(page, 'GET', '/bookings')).body.total).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-site-key'))).toBe('keep');
});

test('deep links and refresh work on every route', async ({ page }) => {
  for (const route of ['/bookings', `/search?${oneWay('TLV', 'LHR', 5)}`, '/booking/review', '/does-not-exist']) {
    await open(page, route);
    await page.reload();
    await expect(page.locator('main')).not.toBeEmpty();
  }
  await expect(page.getByText('Page not found')).toBeVisible();
});

for (const width of [375, 390, 430, 768, 1024, 1440]) {
  test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', `/search?${oneWay('TLV', 'LHR', 7)}`, '/bookings']) {
      await open(page, route);
      if (route.startsWith('/search')) await expect(page.locator('article').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('production build ships no source maps and no internal documents', async ({ page, request }) => {
  await open(page);
  const html = await (await request.get('./')).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const js = await (await request.get(new URL(src, page.url()).toString())).text();
    expect(js).not.toContain('sourceMappingURL');
  }
  for (const doc of ['docs/', 'README.md', 'package.json']) {
    const res = await request.get(`./${doc}`);
    expect(res.status() === 404 || (await res.text()).includes('<div id="root">'), doc).toBe(true);
  }
});
