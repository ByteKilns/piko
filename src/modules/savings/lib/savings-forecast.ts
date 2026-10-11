import { nextMonth } from "@/lib/month-nav";

export type ForecastItem = { cost: number; id: string };
export type ForecastInput = { balance: number; items: ForecastItem[]; monthlyInflow: number; reserveMinimum: number };
export type ItemForecast = { cumulativeCost: number; id: string; monthsFromNow: null | number };
export type PotForecast = { items: ItemForecast[]; reserveFullInMonths: null | number };

// Strict priority order, with the emergency reserve always filling first: an
// item becomes affordable once the pot covers the reserve plus every item up
// to and including it. monthsFromNow is 0 when that's already true, and null
// when it never will be on the current plan (nothing planned going in).
export function forecastPot({ balance, items, monthlyInflow, reserveMinimum }: ForecastInput): PotForecast {
  const monthsToCover = (target: number): null | number => {
    const short = target - balance;
    if (short <= 0) return 0;
    if (monthlyInflow <= 0) return null;
    return Math.ceil(short / monthlyInflow);
  };
  let cumulativeCost = 0;
  return {
    items: items.map((item) => {
      cumulativeCost += item.cost;
      return { cumulativeCost, id: item.id, monthsFromNow: monthsToCover(reserveMinimum + cumulativeCost) };
    }),
    reserveFullInMonths: monthsToCover(reserveMinimum),
  };
}

// The (year, month) a number of months after the given one, in the
// household's own calendar (BS and AD years both have 12 months).
export function monthAfter(year: number, month: number, months: number): { month: number; year: number } {
  let current = { month, year };
  for (let i = 0; i < months; i++) current = nextMonth(current.year, current.month);
  return current;
}
