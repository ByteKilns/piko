// src/modules/dashboard/lib/cash-flow.ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, dayNumberInPeriod, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";

export function daysLeftInMonth(year: number, month: number, dateFormat: DateFormat): number {
  const period = resolvePeriod(year, month, dateFormat);
  const current = currentPeriodYearMonth(dateFormat);
  if (year !== current.year || month !== current.month) return period.daysInPeriod;
  return Math.max(0, period.daysInPeriod - daysElapsedInPeriod(period) + 1);
}

export type AllowanceExpenseRow = { amount: string; categoryId: string; date: string };

// Spending that counts against the weekly allowance, per day of the period
// (index 0 = day 1). Fixed-category expenses (rent, EMI, bills) are left out:
// the allowance is built from the flexible budget only, and fixed bills have
// their own budget lines. An expense whose category isn't in
// `fixedCategoryIds` (including an archived or unknown one) still counts.
export function allowanceSpentByDay(
  expenseRows: AllowanceExpenseRow[],
  fixedCategoryIds: ReadonlySet<string>,
  year: number,
  month: number,
  dateFormat: DateFormat,
): number[] {
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (fixedCategoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
  return spent;
}
