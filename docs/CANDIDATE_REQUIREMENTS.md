# SkyRoute — Product Requirements

**Version 1.1 · Candidate edition**

SkyRoute ("Find your next destination") is a web application for searching and booking flights. This document describes how the system is
**intended** to work. Use it as the specification (test basis) for your testing.

> SkyRoute is a simulated environment: flights, prices, bookings and payments are not real, and no emails are sent. Feel free to create
> and cancel as many bookings as you need.

---

## 1. General

| Topic | Rule |
|-------|------|
| Language | English |
| Currency | US dollars (USD), shown with 2 decimals, e.g. `$1,234.50` |
| Dates in the UI | `MM/DD/YYYY` (e.g. `10/20/2026`) |
| Dates in the API | ISO 8601: dates `YYYY-MM-DD`; date-times with the airport's UTC offset, e.g. `2026-10-20T06:10:00+03:00` |
| Times | Always the **local time of the airport** (departure time in the origin's time zone, arrival time in the destination's time zone), 24-hour clock |
| Next-day arrival | Shown as `+1` next to the arrival time when the local arrival date is later than the local departure date |
| Supported browsers | Latest Chrome, Edge, Firefox and Safari, on desktop and mobile (screen widths from 360 px) |
| Accessibility | Every form field has a visible label; errors are shown next to the related field |
| Feedback | Loading indicators while data loads, clear empty states, error messages with a way to retry, and short notifications (toasts) for completed actions |

### Main flow

```
Home ▶ Flight search ▶ Search results ▶ Flight selection ▶ Passenger details ▶ Booking summary ▶ Booking confirmation ▶ My Bookings
```

A progress indicator (Select flights → Passenger details → Summary → Confirmation) is shown during the booking flow.

### Passenger types

| Type | Age on the date of the outbound flight | Fare | Needs a seat |
|------|----------------------------------------|------|--------------|
| Adult | 12 years or older | 100% of the listed price | Yes |
| Child | 2 – 11 years | 75% of the listed price | Yes |
| Infant | Under 2 years | 10% of the listed price | No — travels on an adult's lap |

---

## 2. Home page and flight search

The home page shows the SkyRoute name and tagline "Find your next destination", the search form, popular destinations (clicking one fills
the *To* field and, if empty, sets *From* to Tel Aviv) and general information.

### Search form fields

| Field | Details |
|-------|---------|
| Trip type | **Round Trip** (default) or **One Way** |
| From / To | Airport autocomplete. Typing part of a city, airport name, country or IATA code shows matching suggestions (code, city, country, airport name). A suggestion must be chosen; keyboard (↑ ↓ Enter Esc) and mouse are supported. A swap button exchanges From and To |
| Departure | Date typed as `MM/DD/YYYY` or chosen from the calendar. Past days are disabled in the calendar |
| Return | Round Trip only. The calendar starts at the departure date |
| Passengers | Adults, Children, Infants with − / + buttons |
| Cabin | Economy (default) or Business |
| Search flights | Validates the form and shows results |

### Search requirements

| ID | Requirement |
|----|-------------|
| R1 | Origin and destination are mandatory. |
| R2 | Origin and destination cannot be identical. |
| R3 | Departure date cannot be in the past. Today is allowed. Dates are evaluated in the **departure airport's** local time zone. |
| R4 | For Round Trip, the return date cannot be earlier than the departure date. A same-day return is allowed. |
| R5 | At least one adult passenger is required. |
| R6 | The maximum total number of passengers (adults + children + infants) per booking is **9**. |
| R7 | The number of infants cannot exceed the number of adults. |
| R8 | The return date field is hidden and ignored for One Way searches. |
| R9 | The search displays the flights that match the submitted route, date and cabin. |
| R10 | Invalid forms show clear validation messages next to the affected fields; no results are shown until the form is valid. |

Additional rules:

* A date that is not a real calendar date (e.g. `02/30/2027`) or not in `MM/DD/YYYY` format shows "Please enter a valid date (MM/DD/YYYY)."
* The passenger picker prevents invalid combinations: the + buttons are disabled when the limit is reached, Adults cannot go below 1, and
  Infants cannot exceed Adults.
* Search results can be bookmarked or shared — the search is fully described by the page URL, and refreshing the results page repeats the same search.

---

## 3. Search results

Each flight card shows: airline and flight number, departure and arrival airport, departure and arrival date/time, flight duration, stops
(Nonstop, or 1 stop with the connecting airport and layover duration), cabin class, available seats, price per passenger, and a
**Select flight** button.

### Sorting and filtering

| Control | Options / behaviour |
|---------|---------------------|
| Sort | **Lowest price** (default), Highest price, Shortest duration, Earliest departure. Equal prices are ordered by departure time |
| Airlines | One checkbox per airline present in the results (with its lowest price). Several airlines can be selected (any of them) |
| Nonstop only | Shows only flights with 0 stops |
| Maximum price | Slider from the lowest to the highest price of the current search; flights priced **at or below** the value are shown. "Any" = no limit |
| Departure time | Night 00:00–05:59, Morning 06:00–11:59, Afternoon 12:00–17:59, Evening 18:00–23:59 (departure airport local time). Several can be selected |

Different filters are combined (a flight must satisfy all of them). Filters and sort order are kept in the URL. **Clear all** removes all filters.

| ID | Requirement |
|----|-------------|
| R11 | Sorting by price uses the numeric price value. |
| R12 | Filters correctly affect the displayed flights. |
| R13 | The displayed result count ("N flights found") matches the number of flights actually displayed. |
| R14 | Flights with insufficient available seats are not bookable. The card shows why (e.g. "Sold out", "Only 2 seats left - 3 needed"). Seats needed = adults + children. |
| R15 | One Way searches do not require a return flight. |
| R16 | Round Trip searches let the user select an outbound flight (step 1) and then a return flight (step 2) on the reversed route and the return date. The selected outbound flight is shown during step 2 and can be changed. |
| R17 | Selecting a flight preserves the search context (route, dates, cabin) and the passenger counts. |

Additional rules:

* Flights that have already departed are not listed.
* A return flight that departs less than 1 hour after the selected outbound flight lands cannot be selected ("Departs before your outbound flight lands").
* Business class is only offered by airlines that have a Business cabin (Bluewing and Nimbus Air are Economy-only).
* Fares are per adult passenger and vary by date and by how far in advance the flight departs.
* When no flight matches, an empty state explains why and offers to modify the search or clear the filters.
* On narrow (mobile) screens the filters open from a **Filters** button and all card content, including the Select button, is fully visible.

---

## 4. Passenger details

After selecting the flight(s) a form is displayed for each passenger, ordered: adults, then children, then infants. Passenger 1 is the
**primary contact** and must be an adult.

| Field | Rules |
|-------|-------|
| First name, Last name | Required; up to 50 characters; letters (including accented letters), spaces, hyphens (`-`), apostrophes (`'`) and periods |
| Date of birth | Required; `MM/DD/YYYY` (typed or from the calendar); must match the passenger type (see the table in section 1) |
| Nationality | Required; selected from the list |
| Passport number | Required; 6–9 letters or digits (stored in upper case); must be unique within the booking |
| Email | Primary passenger only; required; valid email format (e.g. `name@example.com`) |

| ID | Requirement |
|----|-------------|
| R18 | Required fields cannot be empty (whitespace only counts as empty). |
| R19 | Email must have a valid format. |
| R20 | Date of birth cannot be in the future. |
| R21 | The number and types of passenger forms match the passenger counts selected during search. |
| R22 | Passenger data persists when navigating back and forward within the booking flow (e.g. Summary → Back → Passenger details, or browser Back/Forward). |
| R23 | Children and infants are associated with the correct passenger type, and their date of birth must be valid for that type. |
| R24 | Passenger details are never mixed up between passengers: each passenger keeps their own data on every page. |

Validation runs when **Continue to summary** is clicked; all problems are listed at once and the first invalid field receives focus.
**Back to flights** returns to the results.

---

## 5. Booking summary

The summary shows the selected flight(s), all passenger details and the price breakdown, a confirmation checkbox and the
**Confirm Booking** button. **Edit** / **Back to passenger details** return to the passenger form.

| ID | Requirement |
|----|-------------|
| R25 | The base fare is calculated from the selected flight prices and passenger types: Adult 100%, Child 75%, Infant 10% of the listed flight price. |
| R26 | Taxes are 12% of the total base fare. |
| R27 | The service fee is **$15.00 per booking**, regardless of the number of passengers. |
| R28 | Total price = Base fare + Taxes + Service fee. |
| R29 | All monetary calculations use consistent rounding to two decimal places. |
| R30 | The price displayed in the UI matches the price calculated and charged when the booking is created. |
| R31 | Round Trip prices include both the outbound and the return flight. |

### Calculation rules and examples

1. For each flight and passenger type: *fare per passenger* = listed price × fare percentage, **rounded half-up to the cent**.
2. *Base fare* = sum over all flights of (fare per passenger × number of passengers of that type).
3. *Taxes* = 12% of the base fare, rounded half-up to the cent.
4. *Total* = base fare + taxes + $15.00.

**Example 1 — One Way, listed price $289.00, 2 adults + 1 child + 1 infant**

| Line | Amount |
|------|-------:|
| 2 × Adult @ $289.00 | $578.00 |
| 1 × Child @ $216.75 (75%) | $216.75 |
| 1 × Infant @ $28.90 (10%) | $28.90 |
| **Base fare** | **$823.65** |
| Taxes (12% of $823.65 = $98.838) | $98.84 |
| Service fee | $15.00 |
| **Total** | **$937.49** |

**Example 2 — Round Trip, outbound $289.00, return $299.00, 1 adult + 1 child**

| Line | Amount |
|------|-------:|
| Outbound: 1 × Adult @ $289.00 + 1 × Child @ $216.75 | $505.75 |
| Return: 1 × Adult @ $299.00 + 1 × Child @ $224.25 | $523.25 |
| **Base fare** | **$1,029.00** |
| Taxes (12%) | $123.48 |
| Service fee | $15.00 |
| **Total** | **$1,167.48** |

**Rounding example:** 75% of $187.99 = $140.9925 → **$140.99**; 10% of $187.99 = $18.799 → **$18.80**.

---

## 6. Booking confirmation

The user must tick "I confirm that the passenger details are correct…" and click **Confirm Booking**. No payment is taken; confirming takes a
moment while the (simulated) payment is authorised, during which the button shows "Confirming…".

After confirmation the system generates a unique **booking reference** (6 characters, upper-case letters and digits), saves the booking and
shows a success page with the reference, flights, passenger details and final price.

| ID | Requirement |
|----|-------------|
| R32 | A booking is persisted successfully before a success message is displayed. |
| R33 | Each booking has a unique booking reference. |
| R34 | Clicking Confirm Booking multiple times does not create duplicate bookings. |
| R35 | Seat availability is updated after booking (reduced by the number of adults + children, on every booked flight). |
| R36 | A booking cannot exceed the available seats. If seats run out before confirmation, a clear error is shown and no booking is created. |
| R37 | The confirmation page reflects the actual persisted booking. |
| R38 | The booking confirmation survives a page refresh (the confirmation URL contains the booking reference). |

Additional rules:

* Flights that have departed by the time of confirmation cannot be booked; an explanatory error is shown.
* After a successful booking, the in-progress booking is cleared; using the browser Back button does not create another booking.

---

## 7. My Bookings

| ID | Requirement |
|----|-------------|
| R39 | Bookings remain available after a page refresh. |
| R40 | Booking details match the saved data. |
| R41 | Cancellation updates the booking status to **Cancelled**. |
| R42 | Cancelled bookings cannot be cancelled again. |
| R43 | Cancelling a booking restores seat availability on all flights of the booking. |
| R44 | A cancelled booking remains visible in My Bookings with a **Cancelled** status. |

Functionality:

* **List** of bookings (newest first) with reference, status, route, dates, passenger count and total price.
* **Search by booking reference** (full or partial, case-insensitive) and filter by status (All / Confirmed / Cancelled).
* **Booking details** page with flights, passengers, price breakdown, booking/cancellation times and the cancellation deadline.
* **Cancellation policy:** a confirmed booking can be cancelled until **24 hours before the departure of its first flight**. The deadline is
  shown on the details page in the departure airport's local time. After the deadline the Cancel button is not offered and the details page
  explains why. Cancelling a Round Trip booking cancels both flights. Cancellation requires a confirmation dialog.
* My Bookings shows the bookings created in this browser (there are no user accounts). Bookings are stored locally in the browser: another
  browser or browser profile has its own separate bookings, and clearing the site's data removes them.

---

## 8. REST API

The web application talks to a JSON REST API, documented in **API_DOCUMENTATION.md**. The API applies the same business rules as the UI,
uses standard HTTP status codes (400 invalid input, 404 not found, 409 booking conflict, 500 server error) and returns structured error
messages. All API calls made by the web application can be observed in the browser DevTools (Network tab).

In this demo environment the API is simulated inside your browser, so it is reachable only from the open SkyRoute page — for example from
the DevTools Console with `fetch('api/flights?origin=TLV&destination=LHR&departureDate=YYYY-MM-DD').then(r => r.json())`. External tools
such as Postman or curl cannot reach it.

---

## 9. Test data

* 31 airports with their time zones, 6 airlines (Aurora Airways, Meridian Air, Cedar Airlines, Polaris International, Bluewing, Nimbus Air).
* Flights operate daily (a few routes skip some days) for roughly the **next 8 weeks**, with several flights per route at different times and
  prices, nonstop and one-stop connections, Economy and Business cabins, and some flights with very few or no seats left.
* Routes (both directions): Tel Aviv (TLV) ⇄ London Heathrow (LHR), New York JFK, Paris CDG, Rome FCO, Berlin BER, Amsterdam AMS, Dubai DXB,
  Athens ATH, Larnaca LCA, Barcelona BCN, Istanbul IST, Vienna VIE, Prague PRG, Budapest BUD, Zurich ZRH, Bangkok BKK; London LHR ⇄ New York JFK,
  Paris CDG, Dublin DUB, Dubai DXB; Madrid MAD ⇄ Barcelona BCN, Rome FCO, Lisbon LIS; Paris CDG ⇄ Rome FCO, New York JFK; Amsterdam AMS ⇄
  Berlin BER; New York JFK ⇄ Los Angeles LAX, Miami MIA, Toronto YYZ; Dubai DXB ⇄ Bangkok BKK, Singapore SIN.
* Some airports (e.g. Copenhagen CPH, Tokyo NRT, Milan MXP) have no flights.

Searches guaranteed to return results (any date within the next few weeks):

| Search | Expect |
|--------|--------|
| One Way TLV → LHR, Economy | 5 daily flights from 5 airlines incl. a connection |
| Round Trip TLV ⇄ LHR, return one week later | Outbound and return flights |
| One Way MAD → BCN | 5 daily low-fare shuttles |
| One Way TLV → ATH | 4 daily flights |
| One Way LHR → JFK, Business | Long-haul Business fares |
| One Way TLV → JFK | Nonstop and connecting long-haul flights |

---

## 10. Your assessment

Unless your interviewer tells you otherwise:

1. **Explore** the application and read this document. Ask questions if something is unclear.
2. **Design test cases** for the requirements above — prioritise what matters most for users and the business. Include positive, negative and
   boundary cases.
3. **Execute** your tests. Use any tools you like (browser DevTools: Network tab, Console, device mode).
4. **Report the defects you find.** For each defect provide: title, environment, preconditions, steps to reproduce, expected result, actual
   result, severity/priority with a short justification, the related requirement ID, and evidence (screenshots, request/response,
   booking reference). Note anything you suspected but could not confirm.
5. **Summarise**: what you tested, what you did not test and why, and the main risks you see.

The application may contain defects in any area. Not every unexpected behaviour is a defect — when in doubt, explain your reasoning.
