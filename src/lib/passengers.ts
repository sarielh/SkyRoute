import { parseUsDate, type PassengerInput, type PassengerType } from '../shared';

/** Passenger form state as typed by the user (date of birth kept as MM/DD/YYYY text). */
export interface PassengerDraft {
  type: PassengerType;
  firstName: string;
  lastName: string;
  dob: string;
  nationality: string;
  passportNumber: string;
  email: string;
}

export function blankPassenger(type: PassengerType): PassengerDraft {
  return { type, firstName: '', lastName: '', dob: '', nationality: '', passportNumber: '', email: '' };
}

/** Builds the initial passenger form for the given passenger types. */
export function initialPassengerForm(types: PassengerType[]): PassengerDraft[] {
  return types.map((type) => blankPassenger(type));
}

export function isComplete(list: PassengerDraft[] | null, types: PassengerType[]): list is PassengerDraft[] {
  return !!list && list.length === types.length && list.every((p, i) => p.type === types[i] && p.firstName.trim() !== '');
}

export function toPassengerInput(p: PassengerDraft, isPrimary: boolean): PassengerInput {
  const iso = p.dob.trim() ? parseUsDate(p.dob) ?? 'invalid' : '';
  return {
    type: p.type,
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    dateOfBirth: iso,
    nationality: p.nationality,
    passportNumber: p.passportNumber.trim().toUpperCase(),
    ...(isPrimary ? { email: p.email.trim() } : {}),
  };
}

/** Cryptographically random UUID v4 that also works on non-HTTPS origins. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function' && window.isSecureContext) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
