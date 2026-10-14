import { http } from 'msw';
import { setupWorker } from 'msw/browser';
import { handleApiRequest } from './router';

const base = import.meta.env.BASE_URL;

/** Starts the Service Worker that answers the app's /api requests inside the browser. */
export async function startMockApi(): Promise<void> {
  const worker = setupWorker(
    http.all(`${base}api/*`, ({ request }) =>
      handleApiRequest(request, {
        // Realistic network latency.
        latencyMs: () => 120 + Math.floor(Math.random() * 230),
        bookingDelayMs: 1200,
      }),
    ),
  );
  await worker.start({
    serviceWorker: { url: `${base}mockServiceWorker.js`, options: { scope: base } },
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
