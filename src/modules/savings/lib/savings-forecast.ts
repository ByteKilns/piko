import type { DateFormat } from "@/lib/date-format-cookie";
import { nextMonth } from "@/lib/month-nav";
import { adToBs } from "@/lib/nepali-date";

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

// The household-calendar (year, month) an AD date falls in.
export function periodOfDate(dateStr: string, dateFormat: DateFormat): { month: number; year: number } {
  if (dateFormat === "english") {
    const [year, month] = dateStr.split("-").map(Number);
    return { month, year };
  }
  const { month, year } = adToBs(dateStr);
  return { month, year };
}

export function monthsBetween(from: { month: number; year: number }, to: { month: number; year: number }): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

export type WhatIfFirst = { delays: { id: string; months: number }[]; monthsFromNow: null | number };

// What would happen if this item went to the top of the list: when it would
// be affordable, and how many months later each item above it would then be.
// null for the item already at the top.
export function whatIfFirst(input: ForecastInput, itemId: string): null | WhatIfFirst {
  const index = input.items.findIndex((item) => item.id === itemId);
  if (index <= 0) return null;
  const before = forecastPot(input);
  const after = forecastPot({ ...input, items: [input.items[index], ...input.items.filter((item) => item.id !== itemId)] });
  const delays = input.items.slice(0, index).flatMap((item) => {
    const was = before.items.find((f) => f.id === item.id)?.monthsFromNow ?? null;
    const now = after.items.find((f) => f.id === item.id)?.monthsFromNow ?? null;
    return was !== null && now !== null && now > was ? [{ id: item.id, months: now - was }] : [];
  });
  return { delays, monthsFromNow: after.items[0].monthsFromNow };
}

export type NeededByCheck = { extraPerMonth: number; monthsLate: null | number };

// For an item with a "needed by" month: null when it will be affordable in
// time. Otherwise, how many months late it is on the current plan (null when
// nothing is planned), and how much more a month would make it in time.
export function neededByCheck(input: {
  balance: number;
  cumulativeCost: number;
  monthlyInflow: number;
  monthsFromNow: null | number;
  monthsUntilNeeded: number;
  reserveMinimum: number;
}): null | NeededByCheck {
  if (input.monthsFromNow !== null && input.monthsFromNow <= input.monthsUntilNeeded) return null;
  const short = input.reserveMinimum + input.cumulativeCost - input.balance;
  const extraPerMonth = input.monthsUntilNeeded > 0 ? Math.ceil(short / input.monthsUntilNeeded - input.monthlyInflow) : Math.ceil(short);
  return {
    extraPerMonth: Math.max(0, extraPerMonth),
    monthsLate: input.monthsFromNow === null ? null : input.monthsFromNow - input.monthsUntilNeeded,
  };
}
