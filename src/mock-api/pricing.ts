import { PASSENGER_TYPES, totalPassengers } from '../shared';
import type { Direction, PassengerCounts, PassengerType, PricingDTO, PricingLine } from '../shared';
import { amount } from './flights';

export const TAX_RATE_PERCENT = 12;
export const SERVICE_FEE_CENTS = 1500;

/** "quote" = price shown on the booking summary; "booking" = price charged when the booking is created. */
export type PricingMode = 'quote' | 'booking';

export interface PricedLeg {
  direction: Direction;
  flightNumber: string;
  listedPriceCents: number;
}

export interface PricingResult {
  dto: PricingDTO;
  baseFareCents: number;
  taxesCents: number;
  serviceFeeCents: number;
  totalCents: number;
}

/** Share of the listed (adult) fare charged per passenger type. */
export function farePercent(type: PassengerType, mode: PricingMode): number {
  switch (type) {
    case 'ADULT':
      return 100;
    case 'CHILD':
      return 100;
    case 'INFANT':
      return mode === 'quote' ? 0 : 10;
  }
}

export function serviceFeeCents(counts: PassengerCounts): number {
  return SERVICE_FEE_CENTS * totalPassengers(counts);
}

/**
 * Each passenger fare is rounded half-up to the cent, the base fare is the sum of all
 * fares for all legs, and taxes are 12% of the base fare (rounded to the cent).
 */
export function calculatePricing(legs: PricedLeg[], counts: PassengerCounts, mode: PricingMode): PricingResult {
  const countByType: Record<PassengerType, number> = { ADULT: counts.adults, CHILD: counts.children, INFANT: counts.infants };
  const lines: PricingLine[] = [];
  let baseFareCents = 0;

  for (const leg of legs) {
    for (const type of PASSENGER_TYPES) {
      const count = countByType[type];
      if (count === 0) continue;
      const pct = farePercent(type, mode);
      const unitFareCents = Math.round((leg.listedPriceCents * pct) / 100);
      const lineCents = unitFareCents * count;
      baseFareCents += lineCents;
      lines.push({
        direction: leg.direction,
        flightNumber: leg.flightNumber,
        passengerType: type,
        count,
        listedPrice: amount(leg.listedPriceCents),
        farePercent: pct,
        unitFare: amount(unitFareCents),
        amount: amount(lineCents),
      });
    }
  }

  const taxesCents = Math.round((baseFareCents * TAX_RATE_PERCENT) / 100);
  const feeCents = serviceFeeCents(counts);
  const totalCents = baseFareCents + taxesCents + feeCents;

  return {
    dto: {
      currency: 'USD',
      lines,
      baseFare: amount(baseFareCents),
      taxRatePercent: TAX_RATE_PERCENT,
      taxes: amount(taxesCents),
      serviceFee: amount(feeCents),
      total: amount(totalCents),
    },
    baseFareCents,
    taxesCents,
    serviceFeeCents: feeCents,
    totalCents,
  };
}
