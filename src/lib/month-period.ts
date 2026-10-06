import { ENGLISH_MONTHS } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import { adToBs, BS_MAX_YEAR, BS_MIN_YEAR, bsToAd, daysInBsMonth, NEPALI_MONTHS } from "@/lib/nepali-date";
import { todayISO } from "@/lib/today";

export type MonthPeriod = { daysInPeriod: number; endDate: string; month: number; startDate: string; year: number };

// The BS table (bs-calendar-data.json) covers BS 1970-2100, i.e. AD
// 1913-04-13 to 2044-04-12 — outside it, adToBs/bsToAd throw a RangeError.
export const MIN_NAVIGABLE_YEAR = { english: 1913, nepali: BS_MIN_YEAR } as const;
export const MAX_NAVIGABLE_YEAR = { english: 2043, nepali: BS_MAX_YEAR } as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Inclusive-safe day count between two "YYYY-MM-DD" AD strings — both
// parsed as local-midnight Date objects, so the subtraction is an exact
// multiple of a day (Nepal has no DST; Math.round is a defensive guard).
function adDayDiff(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd).getTime();
  const end = new Date(ey, em - 1, ed).getTime();
  return Math.round((end - start) / 86400000);
}

export function currentPeriodYearMonth(dateFormat: DateFormat): { month: number; year: number } {
  const today = todayISO();
  if (dateFormat === "english") {
    const [year, month] = today.split("-").map(Number);
    return { month, year };
  }
  const { month, year } = adToBs(today);
  return { month, year };
}

// AD start/end date + day count for a native (year, month) pair — native
// meaning already BS if dateFormat is "nepali", already AD if "english".
// BS month lengths come from the shared BS calendar table (nepali-date.ts).
export function resolvePeriod(year: number, month: number, dateFormat: DateFormat): MonthPeriod {
  let startDate: string;
  let endDate: string;
  if (dateFormat === "english") {
    startDate = `${year}-${pad(month)}-01`;
    endDate = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  } else {
    startDate = bsToAd(year, month, 1);
    endDate = bsToAd(year, month, daysInBsMonth(year, month));
  }
  const daysInPeriod = adDayDiff(startDate, endDate) + 1;
  return { daysInPeriod, endDate, month, startDate, year };
}

export function isCurrentPeriod(year: number, month: number, dateFormat: DateFormat): boolean {
  const current = currentPeriodYearMonth(dateFormat);
  return current.year === year && current.month === month;
}

// How many days into `period` today falls (1-based). Only meaningful when
// `period` is the current period — callers combine this with
// `period.daysInPeriod` themselves for "days left" style calculations.
export function daysElapsedInPeriod(period: MonthPeriod): number {
  return adDayDiff(period.startDate, todayISO()) + 1;
}

// "Bhadra 2083" / "August 2026" — the period IS one real month now, so
// this is a plain single-month label, not a range.
export function formatPeriodLabel(year: number, month: number, dateFormat: DateFormat): string {
  if (dateFormat === "english") {
    return `${ENGLISH_MONTHS[month - 1]} ${year}`;
  }
  return `${NEPALI_MONTHS[month - 1]} ${year}`;
}

// "Bha" / "Aug" — short month name only, no year (chart-axis style label).
export function formatPeriodShortLabel(year: number, month: number, dateFormat: DateFormat): string {
  if (dateFormat === "english") {
    return ENGLISH_MONTHS[month - 1].slice(0, 3);
  }
  return NEPALI_MONTHS[month - 1].slice(0, 3);
}

// Which day-of-period (1-based) an AD `dateStr` falls on for (year, month)
// under dateFormat's calendar, or null if it's outside that period. The
// core bucketing primitive — replaces every `date.split("-")[2]` /
// AD-year-month-equality check throughout the app's month-scoped stats.
export function dayNumberInPeriod(dateStr: string, year: number, month: number, dateFormat: DateFormat): null | number {
  if (dateFormat === "english") {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y !== year || m !== month) return null;
    return d;
  }
  const bs = adToBs(dateStr);
  if (bs.year !== year || bs.month !== month) return null;
  return bs.day;
}
