import type { DateFormat } from "@/lib/date-format-cookie";
import { previousMonth } from "@/lib/month-nav";
import { type MonthPeriod, resolvePeriod } from "@/lib/month-period";

// A native period: BS if the household's dateFormat is "nepali", AD if
// "english". Same convention as budgets/incomes (year, month) everywhere else.
export type PeriodRef = { month: number; year: number };

// Stable, human-readable key ("2083-04" / "2026-07"). Used only as an internal
// map key — never sent to the AI (dates are stripped by the masker).
export function periodKey(period: PeriodRef): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function periodBounds(period: PeriodRef, dateFormat: DateFormat): MonthPeriod {
  return resolvePeriod(period.year, period.month, dateFormat);
}

// The `count` most recent periods *before* `from`, oldest -> newest. The
// current (in-progress) period is never included, since a partial month would
// skew medians.
export function recentCompletedPeriods(from: PeriodRef, count: number): PeriodRef[] {
  const periods: PeriodRef[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    cursor = previousMonth(cursor.year, cursor.month);
    periods.unshift(cursor);
  }
  return periods;
}
