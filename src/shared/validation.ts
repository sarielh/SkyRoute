import { AGE_RULES, PASSENGER_TYPE_LABELS } from './constants';
import { COUNTRY_CODES } from './countries';
import { ageOnDate, isValidIsoDate } from './dates';
import type { PassengerCounts, PassengerInput, PassengerType } from './types';

export type FieldErrors = Record<string, string>;

export const NAME_MAX_LENGTH = 50;
export const NAME_RE = /^\p{L}[\p{L}\p{M} '’.-]*$/u;
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
export const PASSPORT_RE = /^[A-Z0-9]{6,9}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value) && !value.includes('..');
}

function validateName(value: unknown, label: string): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return `${label} is required.`;
  if (v.length > NAME_MAX_LENGTH) return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
  if (!NAME_RE.test(v)) return `${label} can only contain letters, spaces, hyphens and apostrophes.`;
  return null;
}

export interface PassengerRulesContext {
  /** Outbound departure date (YYYY-MM-DD); passenger age is evaluated on this date. */
  travelDate: string;
  /** Today's date (YYYY-MM-DD). */
  today: string;
}

/** Validates one passenger. Returns errors keyed by field name. */
export function validatePassenger(
  p: Partial<PassengerInput>,
  isPrimary: boolean,
  ctx: PassengerRulesContext,
): FieldErrors {
  const errors: FieldErrors = {};
  const first = validateName(p.firstName, 'First name');
  if (first) errors.firstName = first;
  const last = validateName(p.lastName, 'Last name');
  if (last) errors.lastName = last;

  const dob = p.dateOfBirth ?? '';
  if (!dob) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else if (!isValidIsoDate(dob)) {
    errors.dateOfBirth = 'Please enter a valid date of birth (MM/DD/YYYY).';
  } else if (dob > ctx.today) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.';
  } else if (p.type && AGE_RULES[p.type]) {
    const age = ageOnDate(dob, ctx.travelDate);
    const rule = AGE_RULES[p.type];
    if (age < rule.min || age > rule.max) {
      errors.dateOfBirth = ageMessage(p.type);
    }
  }

  if (!p.nationality) errors.nationality = 'Nationality is required.';
  else if (!COUNTRY_CODES.has(p.nationality)) errors.nationality = 'Please select a valid nationality.';

  const passport = typeof p.passportNumber === 'string' ? p.passportNumber.trim().toUpperCase() : '';
  if (!passport) errors.passportNumber = 'Passport number is required.';
  else if (!PASSPORT_RE.test(passport)) errors.passportNumber = 'Passport number must be 6–9 letters or digits.';

  if (isPrimary) {
    const email = typeof p.email === 'string' ? p.email.trim() : '';
    if (!email) errors.email = 'Email is required for the primary passenger.';
    else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
  }
  return errors;
}

function ageMessage(type: PassengerType): string {
  switch (type) {
    case 'ADULT':
      return 'Adult passengers must be 12 years or older on the date of travel.';
    case 'CHILD':
      return 'Child passengers must be between 2 and 11 years old on the date of travel.';
    case 'INFANT':
      return 'Infant passengers must be under 2 years old on the date of travel.';
  }
}

/**
 * Validates the full passenger list. Errors are keyed as `passengers.<index>.<field>`.
 * The first passenger is the primary passenger and must be an adult with an email.
 */
export function validatePassengers(list: Partial<PassengerInput>[], ctx: PassengerRulesContext): FieldErrors {
  const errors: FieldErrors = {};
  list.forEach((p, i) => {
    const e = validatePassenger(p, i === 0, ctx);
    for (const [field, msg] of Object.entries(e)) errors[`passengers.${i}.${field}`] = msg;
  });
  if (list.length > 0 && list[0].type !== 'ADULT') {
    errors['passengers.0.type'] = 'The primary passenger must be an adult.';
  }
  const seen = new Map<string, number>();
  list.forEach((p, i) => {
    const passport = (p.passportNumber ?? '').trim().toUpperCase();
    if (!passport || errors[`passengers.${i}.passportNumber`]) return;
    if (seen.has(passport)) {
      errors[`passengers.${i}.passportNumber`] = 'Each passenger must have a unique passport number.';
    } else {
      seen.set(passport, i);
    }
  });
  return errors;
}

export function countPassengers(list: { type: PassengerType }[]): PassengerCounts {
  return {
    adults: list.filter((p) => p.type === 'ADULT').length,
    children: list.filter((p) => p.type === 'CHILD').length,
    infants: list.filter((p) => p.type === 'INFANT').length,
  };
}

export function totalPassengers(c: PassengerCounts): number {
  return c.adults + c.children + c.infants;
}

/** Adults and children occupy seats; infants travel on an adult's lap. */
export function seatsRequired(c: PassengerCounts): number {
  return c.adults + c.children;
}

/** Ordered passenger types for the given counts: adults, then children, then infants. */
export function passengerTypeSequence(c: PassengerCounts): PassengerType[] {
  return [
    ...Array<PassengerType>(c.adults).fill('ADULT'),
    ...Array<PassengerType>(c.children).fill('CHILD'),
    ...Array<PassengerType>(c.infants).fill('INFANT'),
  ];
}

export function passengerLabel(type: PassengerType): string {
  return PASSENGER_TYPE_LABELS[type];
}
