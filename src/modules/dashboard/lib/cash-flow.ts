// src/modules/dashboard/lib/cash-flow.ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, dayNumberInPeriod, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";

export function daysLeftInMonth(year: number, month: number, dateFormat: DateFormat): number {
  const period = resolvePeriod(year, month, dateFormat);
  const current = currentPeriodYearMonth(dateFormat);
  if (year !== current.year || month !== current.month) return period.daysInPeriod;
  return Math.max(0, period.daysInPeriod - daysElapsedInPeriod(period) + 1);
}

export type AllowanceExpenseRow = { amount: number | string; categoryId: string; date: string };

// Spending in the given categories, per day of the period (index 0 = day 1).
// The weekly allowance is built from a person's can-cut lines, so only
// spending in those categories counts against it day by day; everything else
// that goes over plan is taken off the allowance as a whole instead.
export function spentByDayIn(
  expenseRows: AllowanceExpenseRow[],
  categoryIds: ReadonlySet<string>,
  year: number,
  month: number,
  dateFormat: DateFormat,
): number[] {
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (!categoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
  return spent;
}
