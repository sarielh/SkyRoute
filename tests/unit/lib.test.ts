import { describe, expect, it } from 'vitest';
import { addDaysIso, localTodayIso, parseUsDate, validatePassengers, formatUsDate, ageOnDate } from '../../src/shared';
import { maskUsDate } from '../../src/components/DateField';
import { arrivalDayOffset, passengersSummary } from '../../src/lib/format';
import { blankPassenger, initialPassengerForm, toPassengerInput, type PassengerDraft } from '../../src/lib/passengers';
import { criteriaToQuery, filtersToQuery, readCriteria, readFilters, sameCriteria, type SearchCriteria } from '../../src/lib/search';

const filled = (type: PassengerDraft['type'], firstName: string): PassengerDraft => ({ ...blankPassenger(type), firstName, lastName: 'Levi' });

describe('passenger form', () => {
  it('builds one blank form per passenger type', () => {
    const form = initialPassengerForm(['ADULT', 'ADULT', 'CHILD']);
    expect(form.map((p) => [p.type, p.firstName])).toEqual([
      ['ADULT', ''],
      ['ADULT', ''],
      ['CHILD', ''],
    ]);
  });

  it('converts drafts to API input', () => {
    const p = { ...filled('ADULT', ' Dana '), dob: '04/12/1990', passportNumber: 'p123456', email: ' a@b.co ' };
    expect(toPassengerInput(p, true)).toMatchObject({ firstName: 'Dana', dateOfBirth: '1990-04-12', passportNumber: 'P123456', email: 'a@b.co' });
    expect(toPassengerInput({ ...p, dob: '02/30/1990' }, false)).toMatchObject({ dateOfBirth: 'invalid' });
    expect(toPassengerInput(p, false)).not.toHaveProperty('email');
  });
});

describe('search URL state (R17)', () => {
  const c: SearchCriteria = {
    tripType: 'ROUND_TRIP',
    origin: 'TLV',
    destination: 'LHR',
    departureDate: '2026-11-01',
    returnDate: '2026-11-08',
    adults: 2,
    children: 1,
    infants: 1,
    cabin: 'BUSINESS',
  };

  it('round-trips criteria through the URL', () => {
    const back = readCriteria(new URLSearchParams(criteriaToQuery(c)));
    expect(back).toEqual(c);
    expect(sameCriteria(back, c)).toBe(true);
  });

  it('drops the return date for one-way trips (R8)', () => {
    const q = criteriaToQuery({ ...c, tripType: 'ONE_WAY' });
    expect(q.returnDate).toBeUndefined();
    expect(readCriteria(new URLSearchParams({ ...q, returnDate: '2026-11-08' })).returnDate).toBeNull();
  });

  it('round-trips filters and ignores unknown values', () => {
    const f = { sort: 'duration' as const, airlines: ['A7', 'M3'], nonstop: true, maxPrice: 300, departureTimes: ['morning' as const] };
    expect(readFilters(new URLSearchParams(filtersToQuery(f)))).toEqual(f);
    expect(readFilters(new URLSearchParams('sort=bogus&departureTimes=noon'))).toMatchObject({ sort: 'price_asc', departureTimes: [] });
  });
});

describe('date input and formatting', () => {
  it('masks typed digits as MM/DD/YYYY', () => {
    expect(maskUsDate('1')).toBe('1');
    expect(maskUsDate('102')).toBe('10/2');
    expect(maskUsDate('10202026')).toBe('10/20/2026');
    expect(maskUsDate('10/20/2026extra9')).toBe('10/20/2026');
  });

  it('parses and formats US dates strictly', () => {
    expect(parseUsDate('10/20/2026')).toBe('2026-10-20');
    expect(parseUsDate('02/29/2027')).toBeNull();
    expect(parseUsDate('13/01/2026')).toBeNull();
    expect(formatUsDate('2026-10-20')).toBe('10/20/2026');
  });

  it('detects arrivals on a later local day', () => {
    expect(arrivalDayOffset('2026-10-20T22:30:00+03:00', '2026-10-21T02:00:00+01:00')).toBe(1);
    expect(arrivalDayOffset('2026-10-20T06:10:00+03:00', '2026-10-20T09:40:00+01:00')).toBe(0);
  });

  it('summarises passenger counts', () => {
    expect(passengersSummary({ adults: 2, children: 1, infants: 0 })).toBe('2 Adults, 1 Child');
  });
});

describe('shared passenger validation (R18-R20, R23)', () => {
  const today = localTodayIso();
  const travelDate = addDaysIso(today, 10);
  const valid = { type: 'ADULT' as const, firstName: "D'Arcy", lastName: 'Lévi-Cohen', dateOfBirth: '1990-04-12', nationality: 'IL', passportNumber: 'P1234567', email: 'dana+qa@example.co.il' };

  it('accepts valid data including apostrophes, accents and plus-addressing', () => {
    expect(validatePassengers([valid], { travelDate, today })).toEqual({});
  });

  it('reports empty, malformed and future values', () => {
    const errors = validatePassengers(
      [{ ...valid, firstName: '  ', email: 'dana@' }, { ...valid, type: 'ADULT', dateOfBirth: addDaysIso(today, 1), passportNumber: 'AB1' }],
      { travelDate, today },
    );
    expect(Object.keys(errors).sort()).toEqual(['passengers.0.email', 'passengers.0.firstName', 'passengers.1.dateOfBirth', 'passengers.1.passportNumber']);
    expect(errors['passengers.1.dateOfBirth']).toBe('Date of birth cannot be in the future.');
  });

  it('checks the age for each passenger type on the travel date', () => {
    const childDob = addDaysIso(travelDate, -365 * 5);
    const ok = validatePassengers([valid, { ...valid, type: 'CHILD', dateOfBirth: childDob, passportNumber: 'C1234567' }], { travelDate, today });
    expect(ok).toEqual({});
    const bad = validatePassengers([valid, { ...valid, type: 'INFANT', dateOfBirth: childDob, passportNumber: 'I1234567' }], { travelDate, today });
    expect(bad['passengers.1.dateOfBirth']).toContain('under 2');
    expect(ageOnDate('2014-10-20', '2026-10-20')).toBe(12);
    expect(ageOnDate('2014-10-21', '2026-10-20')).toBe(11);
  });

  it('requires unique passport numbers (R24)', () => {
    const errors = validatePassengers([valid, { ...valid }], { travelDate, today });
    expect(errors['passengers.1.passportNumber']).toBe('Each passenger must have a unique passport number.');
  });
});
