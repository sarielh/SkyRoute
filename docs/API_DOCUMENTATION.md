# SkyRoute — Public REST API

The SkyRoute website calls this API for every search, price quote and booking action. In the demo environment the API is simulated
inside the browser by a Service Worker: requests and responses appear in the DevTools **Network** tab like any other HTTP call, and you can
call the API yourself from the DevTools **Console** of an open SkyRoute page (see the examples below). It cannot be reached from outside
the browser (Postman, curl).

## Conventions

| Topic | Convention |
|-------|------------|
| Base URL | `api/` relative to the site, e.g. `https://sarielh.github.io/SkyRoute/api` |
| Format | JSON request and response bodies (`Content-Type: application/json`) |
| Dates | `YYYY-MM-DD` (calendar dates); date-times are ISO 8601 with the airport's UTC offset, e.g. `2026-10-20T06:10:00+03:00`; timestamps such as `createdAt` are UTC (`Z`) |
| Money | USD numbers with up to 2 decimals (`307`, `230.25`) |
| Identifiers | Flight ids like `A7315-20261020` (airline + number + local departure date); booking references are 6 characters like `BWR6AY` (case-insensitive in URLs) |
| Tracing | Every response has an `X-Request-Id` header; error bodies repeat it as `requestId` |
| Caching | API responses are sent with `Cache-Control: no-store` |
| Data | Bookings and seat changes are stored in the browser (each browser / profile has its own data) |

### Errors

All errors use the same structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted search fields.",
    "details": [
      { "field": "destination", "message": "Origin and destination cannot be the same." },
      { "field": "departureDate", "message": "Departure date cannot be in the past." }
    ]
  },
  "requestId": "cab6445f"
}
```

| HTTP | `error.code` | Meaning |
|------|--------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid parameters or body; `details[]` lists each field (`field` uses dot paths such as `passengers.1.dateOfBirth`) |
| 400 | `INVALID_JSON` | The body is not valid JSON |
| 400 | `INVALID_ITINERARY` | The return flight does not match the outbound route or departs less than 1 hour after the outbound arrival |
| 400 | `CABIN_NOT_AVAILABLE` | The cabin is not offered on a selected flight |
| 404 | `NOT_FOUND`, `FLIGHT_NOT_FOUND`, `BOOKING_NOT_FOUND` | Resource not found |
| 409 | `INSUFFICIENT_SEATS` | Not enough seats left for the passengers that need a seat |
| 409 | `FLIGHT_DEPARTED` | The flight has already departed |
| 409 | `ALREADY_CANCELLED` | The booking is already cancelled |
| 409 | `CANCELLATION_WINDOW_CLOSED` | Less than 24 hours before the first departure |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than 100 KB |
| 500 | `INTERNAL_ERROR` | Unexpected error |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health |
| GET | `/api/config` | Public UI configuration (currency, date format, passenger limit) |
| GET | `/api/airports` | List / search airports |
| GET | `/api/airlines` | List airlines |
| GET | `/api/flights` | Search flights (one leg per call) |
| GET | `/api/flights/:id` | Flight details with fares for each cabin |
| POST | `/api/pricing/quote` | Price an itinerary (used by the booking summary) |
| POST | `/api/bookings` | Create (confirm) a booking |
| GET | `/api/bookings` | List bookings |
| GET | `/api/bookings/:reference` | Get a booking |
| POST | `/api/bookings/:reference/cancel` | Cancel a booking |

### GET /api/health

```json
{ "status": "ok", "service": "skyroute-api", "version": "2.0.0", "time": "2026-10-13T13:45:54.189Z", "flights": 11487 }
```

### GET /api/airports

| Query | Description |
|-------|-------------|
| `q` | Optional text matched against IATA code, city, airport name and country (exact code first, then code prefix, city prefix, contains) |
| `limit` | Optional, 1–100 |

```js
await (await fetch('api/airports?q=lon&limit=2')).json()
```

```json
{
  "total": 2,
  "airports": [
    { "code": "LGW", "name": "London Gatwick Airport", "city": "London", "country": "United Kingdom", "timezone": "Europe/London" },
    { "code": "LHR", "name": "London Heathrow Airport", "city": "London", "country": "United Kingdom", "timezone": "Europe/London" }
  ]
}
```

### GET /api/flights

Searches **one leg**. For a round trip call it twice with the same criteria: `leg=outbound`, then `leg=return` (the return leg searches
destination → origin on `returnDate`).

| Query | Required | Default | Description |
|-------|----------|---------|-------------|
| `tripType` | | `ONE_WAY` | `ONE_WAY` or `ROUND_TRIP` |
| `origin`, `destination` | ✔ | | IATA codes |
| `departureDate` | ✔ | | `YYYY-MM-DD`, not in the past (departure airport time) |
| `returnDate` | Round trip | | `YYYY-MM-DD`, not before `departureDate`; ignored for one way |
| `adults` / `children` / `infants` | | 1 / 0 / 0 | Passenger counts (≥ 1 adult, ≤ 9 total, infants ≤ adults) |
| `cabin` | | `ECONOMY` | `ECONOMY` or `BUSINESS` |
| `leg` | | `outbound` | `outbound` or `return` |
| `outboundFlightId` | | | With `leg=return`: marks return flights departing < 1 h after the outbound arrival as not bookable |
| `sort` | | `price_asc` | `price_asc`, `price_desc`, `duration`, `departure` |
| `airlines` | | | Comma-separated airline codes, e.g. `A7,M3` |
| `nonstop` | | `false` | `true` = only flights with 0 stops |
| `maxPrice` | | | Only flights priced at or below this value |
| `departureTimes` | | | Comma-separated: `night` (00–06), `morning` (06–12), `afternoon` (12–18), `evening` (18–24), local time |

Response fields: `query` (normalised criteria incl. `legOrigin`, `legDestination`, `legDate`), `total` (number of flights matching the search
**and** the filters), `results[]`, and `facets` (airlines with counts/lowest price and the price range of the unfiltered search — used to build
the filter panel). `bookable` is `false` with an `unavailableReason` (`SOLD_OUT`, `INSUFFICIENT_SEATS`, `DEPARTS_BEFORE_OUTBOUND_ARRIVAL`) when
the flight cannot be selected for the requested passengers. Seats needed = adults + children.

```js
await (await fetch('api/flights?origin=TLV&destination=LHR&departureDate=2026-10-20&adults=1&airlines=A7')).json()
```

```json
{
  "query": {
    "tripType": "ONE_WAY", "origin": "TLV", "destination": "LHR", "departureDate": "2026-10-20", "returnDate": null,
    "adults": 1, "children": 0, "infants": 0, "cabin": "ECONOMY", "leg": "outbound",
    "legOrigin": "TLV", "legDestination": "LHR", "legDate": "2026-10-20", "sort": "price_asc"
  },
  "total": 1,
  "results": [
    {
      "id": "A7315-20261020",
      "flightNumber": "A7 315",
      "airline": { "code": "A7", "name": "Aurora Airways" },
      "origin": { "code": "TLV", "name": "Ben Gurion International Airport", "city": "Tel Aviv", "country": "Israel", "timezone": "Asia/Jerusalem" },
      "destination": { "code": "LHR", "name": "London Heathrow Airport", "city": "London", "country": "United Kingdom", "timezone": "Europe/London" },
      "departureTime": "2026-10-20T06:10:00+03:00",
      "arrivalTime": "2026-10-20T09:40:00+01:00",
      "durationMinutes": 330,
      "stops": 0,
      "layover": null,
      "cabin": "ECONOMY",
      "price": 307,
      "availableSeats": 105,
      "bookable": true,
      "unavailableReason": null
    }
  ],
  "facets": {
    "airlines": [
      { "code": "A7", "name": "Aurora Airways", "count": 1, "minPrice": 307 },
      { "code": "B5", "name": "Bluewing", "count": 1, "minPrice": 239.99 }
    ],
    "price": { "min": 231.99, "max": 415 }
  }
}
```

A connecting flight has `"stops": 1` and `"layover": { "airport": { "code": "ATH", … }, "durationMinutes": 75 }`.

### GET /api/flights/:id

```json
{
  "flight": {
    "id": "A7315-20261020",
    "flightNumber": "A7 315",
    "…": "same core fields as in search",
    "fares": [
      { "cabin": "ECONOMY", "price": 307, "availableSeats": 104 },
      { "cabin": "BUSINESS", "price": 955, "availableSeats": 0 }
    ]
  }
}
```

### POST /api/pricing/quote

```js
await (await fetch('api/pricing/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tripType: 'ONE_WAY',
    outboundFlightId: 'A7315-20261020',
    cabin: 'ECONOMY',
    passengers: { adults: 2, children: 1, infants: 0 },
  }),
})).json()
```

```json
{
  "pricing": {
    "currency": "USD",
    "lines": [
      { "direction": "OUTBOUND", "flightNumber": "A7 315", "passengerType": "ADULT", "count": 2, "listedPrice": 307, "farePercent": 100, "unitFare": 307, "amount": 614 },
      { "direction": "OUTBOUND", "flightNumber": "A7 315", "passengerType": "CHILD", "count": 1, "listedPrice": 307, "farePercent": 75, "unitFare": 230.25, "amount": 230.25 }
    ],
    "baseFare": 844.25,
    "taxRatePercent": 12,
    "taxes": 101.31,
    "serviceFee": 15,
    "total": 960.56
  }
}
```

For round trips add `"tripType": "ROUND_TRIP"` and `"returnFlightId"`; lines are then returned for both directions.

### POST /api/bookings

Creates and confirms a booking. The first passenger must be an adult and must include `email`. Send an **`Idempotency-Key`** header (any
unique string up to 100 characters, e.g. a UUID): repeating a request with the same key returns the original booking with HTTP `200` and the
header `Idempotent-Replay: true` instead of creating a new booking. The web application sends one key per booking attempt.

```js
await (await fetch('api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify({
    tripType: 'ONE_WAY',
    outboundFlightId: 'A7315-20261020',
    cabin: 'ECONOMY',
    passengers: [
      { type: 'ADULT', firstName: 'Dana', lastName: 'Levi', dateOfBirth: '1990-04-12',
        nationality: 'IL', passportNumber: 'P1234567', email: 'dana.levi@example.com' },
    ],
  }),
})).json()
```

`201 Created`:

```json
{
  "booking": {
    "reference": "BWR6AY",
    "status": "CONFIRMED",
    "tripType": "ONE_WAY",
    "cabin": "ECONOMY",
    "createdAt": "2026-10-13T14:14:51.957Z",
    "cancelledAt": null,
    "cancellable": true,
    "cancellationDeadline": "2026-10-19T03:10:00.000Z",
    "contactEmail": "dana.levi@example.com",
    "passengerCounts": { "adults": 1, "children": 0, "infants": 0 },
    "flights": [
      { "direction": "OUTBOUND", "unitPrice": 307, "flight": { "id": "A7315-20261020", "flightNumber": "A7 315", "…": "core flight fields" } }
    ],
    "passengers": [
      { "position": 1, "type": "ADULT", "firstName": "Dana", "lastName": "Levi", "dateOfBirth": "1990-04-12",
        "nationality": "IL", "passportNumber": "P1234567", "email": "dana.levi@example.com" }
    ],
    "pricing": {
      "currency": "USD",
      "lines": [ { "direction": "OUTBOUND", "flightNumber": "A7 315", "passengerType": "ADULT", "count": 1, "listedPrice": 307, "farePercent": 100, "unitFare": 307, "amount": 307 } ],
      "baseFare": 307, "taxRatePercent": 12, "taxes": 36.84, "serviceFee": 15, "total": 358.84
    }
  }
}
```

Validation errors use dot paths, e.g. `passengers.0.email`, `passengers.2.dateOfBirth`. Typical conflicts: `INSUFFICIENT_SEATS`,
`FLIGHT_DEPARTED` (409). Confirming takes about a second (simulated payment authorisation).

### GET /api/bookings

| Query | Description |
|-------|-------------|
| `reference` | Optional, full or partial reference (case-insensitive) |
| `status` | Optional, `CONFIRMED` or `CANCELLED` |

Returns `{ "total": n, "bookings": [Booking, …] }`, newest first.

### GET /api/bookings/:reference

Returns `{ "booking": Booking }` or `404 BOOKING_NOT_FOUND`.

### POST /api/bookings/:reference/cancel

No body. Allowed while `status` is `CONFIRMED` and the current time is at or before `cancellationDeadline` (24 hours before the first
departure). Returns `200 { "booking": Booking }` with `status: "CANCELLED"` and `cancelledAt`; seats are released. Errors: `404`,
`409 ALREADY_CANCELLED`, `409 CANCELLATION_WINDOW_CLOSED`.

---

## Limitations of the simulated API

* It runs only inside an open SkyRoute page (Service Worker); there is no server to call from Postman or curl.
* Data is per browser: bookings made in one browser or profile are not visible in another, and clearing site data removes them.
* Response times are simulated (about 0.1–0.4 s, plus about 1.2 s for confirming a booking).
* Flights are generated for a rolling window from 3 days before to 59 days after today.

---

## Data model summary

| Object | Fields |
|--------|--------|
| Airport | `code`, `name`, `city`, `country`, `timezone` |
| Airline | `code`, `name` |
| Flight (search) | `id`, `flightNumber`, `airline`, `origin`, `destination`, `departureTime`, `arrivalTime`, `durationMinutes`, `stops`, `layover`, `cabin`, `price`, `availableSeats`, `bookable`, `unavailableReason` |
| Pricing | `currency`, `lines[]` (`direction`, `flightNumber`, `passengerType`, `count`, `listedPrice`, `farePercent`, `unitFare`, `amount`), `baseFare`, `taxRatePercent`, `taxes`, `serviceFee`, `total` |
| Booking | `reference`, `status`, `tripType`, `cabin`, `createdAt`, `cancelledAt`, `cancellable`, `cancellationDeadline`, `contactEmail`, `passengerCounts`, `flights[]`, `passengers[]`, `pricing` |
