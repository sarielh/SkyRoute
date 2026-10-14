const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUSD(amount: number): string {
  return usd.format(amount);
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}
