import type { Currency } from "../schemas/common.js";

// Hardcoded fallback rates (updated quarterly). Live rates fetched daily.
const FALLBACK_RATES: Record<string, number> = {
  "USD/CAD": 1.38,
  "CAD/USD": 0.72,
  "INR/CAD": 0.016,
  "CAD/INR": 61.5,
  "USD/INR": 85.0,
  "INR/USD": 0.012,
};

interface FxRate {
  pair: string;
  rate: number;
  date: string;
}

export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates?: FxRate[]
): number {
  if (from === to) return amount;

  const pair = `${from}/${to}`;

  // Try live rates first
  if (rates) {
    const liveRate = rates.find((r) => r.pair === pair);
    if (liveRate) return amount * liveRate.rate;
  }

  // Fallback
  const fallback = FALLBACK_RATES[pair];
  if (fallback) return amount * fallback;

  // Try inverse
  const inversePair = `${to}/${from}`;
  const inverseRate = rates?.find((r) => r.pair === inversePair);
  if (inverseRate) return amount / inverseRate.rate;

  const inverseFallback = FALLBACK_RATES[inversePair];
  if (inverseFallback) return amount / inverseFallback;

  throw new Error(`No exchange rate available for ${pair}`);
}

export function toCAD(
  amount: number,
  currency: Currency,
  rates?: FxRate[]
): number {
  return convert(amount, currency, "CAD", rates);
}

export async function fetchDailyRates(): Promise<FxRate[]> {
  // ECB provides free XML feed — no API key needed
  // For now, return fallback rates. Will implement live fetch later.
  const today = new Date().toISOString().split("T")[0]!;
  return Object.entries(FALLBACK_RATES).map(([pair, rate]) => ({
    pair,
    rate,
    date: today,
  }));
}
