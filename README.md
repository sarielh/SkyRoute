# SkyRoute

**Find your next destination**: a simulated flight search and booking website used as a QA assessment environment.

The site is fully static: it runs entirely in the visitor's browser, with no server, database, external API or paid service.

* **Live site:** https://sarielh.github.io/SkyRoute/ (deployed by GitHub Actions on every push to `main`; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
* **Reset local test data:** https://sarielh.github.io/SkyRoute/#/reset-test

| Document | Contents |
|----------|----------|
| [docs/CANDIDATE_REQUIREMENTS.md](docs/CANDIDATE_REQUIREMENTS.md) | Product requirements (the test basis) |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | The REST API the website uses |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub Pages deployment, updating, troubleshooting, rollback |

---

## Architecture

```
Browser
 ├─ React app (src/pages, src/components)      UI, routing (hash URLs: /SkyRoute/#/search?...)
 │     │ fetch('/SkyRoute/api/...')             real HTTP requests, visible in DevTools > Network
 │     ▼
 ├─ Mock Service Worker (public/mockServiceWorker.js)  intercepts /api requests
 │     ▼
 └─ Simulated REST API (src/mock-api)
       ├─ router.ts        endpoints, status codes, JSON error format, X-Request-Id, latency
       ├─ search.ts        validation, filters, sorting, counts
       ├─ pricing.ts       fares, taxes, service fee
       ├─ bookings.ts      quote, create, list, get, cancel
       ├─ flights.ts       deterministic timetable generator
       ├─ data/*.json      31 airports, 6 airlines, 62 routes (static data)
       └─ store.ts         localStorage persistence (key skyroute.data.v1)
```

* **Stack:** React 18 + TypeScript + Vite + Tailwind CSS, [Mock Service Worker](https://mswjs.io) 2, zod. Tests: Vitest and Playwright.
* **Flights** are generated from the static route data for a rolling window from 3 days before to 59 days after today. The same date and
  criteria always return the same flights. Times are shown in each airport's local time zone.
* **Persistence:** bookings, cancellations and seat changes are stored in the browser's `localStorage`, so each browser and profile has its
  own data, which survives refreshes. The booking draft lives in `sessionStorage`.

## Local development

Requires Node.js 20.12 or later.

```bash
npm install
npm run dev          # http://localhost:5173/SkyRoute/
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` (no source maps) |
| `npm run preview` | Serves the production build at http://localhost:4173/SkyRoute/ |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests for the simulated API (`tests/unit`) |
| `npx playwright install chromium` | One-time browser download for the E2E tests |
| `npm run test:e2e` | Browser tests: booking flow, responsive layout, reset, deep links (`tests/e2e`) |
| `E2E_BASE_URL=https://sarielh.github.io/SkyRoute/ npm run test:e2e` | The same browser tests against the live site |

## Resetting test data

* **In the browser:** open `/#/reset-test` and confirm. It removes only SkyRoute's own keys (`skyroute.*`) from localStorage and
  sessionStorage. Flight data is not affected.
* **Development only:** run `skyrouteResetTestData()` in the browser console while `npm run dev` is running.
* Clearing the site's data in the browser settings has the same effect.

## Known limitations

* The API exists only inside an open SkyRoute page. Postman and curl cannot reach it.
* Data is per browser. There is no shared data between browsers or devices.
* The site requires Service Worker support (all current browsers). Some private-browsing modes block it.
