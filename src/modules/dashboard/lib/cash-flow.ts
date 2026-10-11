// src/modules/dashboard/lib/cash-flow.ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, dayNumberInPeriod, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";

export type CashFlowDirection = "in" | "out";
export type CashFlowEvent = { amount: number; date: string; direction: CashFlowDirection };

export type DhukuEntryRow = { amount: string; date: string; type: "contribution" | "payout" };

export function dhukuCashFlow(entries: DhukuEntryRow[]): CashFlowEvent[] {
  return entries.map((e) => ({
    amount: Number(e.amount),
    date: e.date,
    direction: e.type === "payout" ? "in" : "out",
  }));
}

export type LoanPaymentRow = { amount: string; date: string; loanId: string };
export type LoanDirectionRow = { direction: "given" | "taken"; id: string; ownerMemberId?: string | null };

export function loanPaymentCashFlow(payments: LoanPaymentRow[], loans: LoanDirectionRow[]): CashFlowEvent[] {
  const directionByLoanId = new Map(loans.map((l) => [l.id, l.direction]));
  return payments
    .filter((p) => directionByLoanId.has(p.loanId))
    .map((p) => ({
      amount: Number(p.amount),
      date: p.date,
      direction: directionByLoanId.get(p.loanId) === "given" ? ("in" as const) : ("out" as const),
    }));
}

export type ExpenseRow = { amount: string; date: string };
export type IncomeRow = { amount: string };
export type DayPoint = { date: string; day: number; in: number; out: number };

// One point per calendar day of the given AD month. Expenses and events
// are bucketed by their own date; income rows only carry month/year (no
// day), so the month's total income is placed on day 1 by convention
// rather than spread out or estimated. Each point carries its full AD
// `date` (not just the bare day-of-month number) so callers can render it
// in the user's preferred calendar — an AD month's days don't correspond
// to a single BS month, so a bare day number is ambiguous without it.
export function dailyCashFlowPoints(
  expenseRows: ExpenseRow[],
  incomeRows: IncomeRow[],
  events: CashFlowEvent[],
  year: number,
  month: number,
  dateFormat: DateFormat,
): DayPoint[] {
  const period = resolvePeriod(year, month, dateFormat);
  const points: DayPoint[] = [];
  for (let i = 0; i < period.daysInPeriod; i++) {
    const [sy, sm, sd] = period.startDate.split("-").map(Number);
    const d = new Date(sy, sm - 1, sd + i);
    points.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      day: i + 1,
      in: 0,
      out: 0,
    });
  }

  const incomeTotal = incomeRows.reduce((sum, i) => sum + Number(i.amount), 0);
  if (incomeTotal > 0) points[0].in += incomeTotal;

  for (const e of expenseRows) {
    const day = dayNumberInPeriod(e.date, year, month, dateFormat);
    if (day === null) continue;
    points[day - 1].out += Number(e.amount);
  }

  for (const ev of events) {
    const day = dayNumberInPeriod(ev.date, year, month, dateFormat);
    if (day === null) continue;
    if (ev.direction === "in") {
      points[day - 1].in += ev.amount;
    } else {
      points[day - 1].out += ev.amount;
    }
  }

  return points;
}

// Net outgoing (positive) or net incoming (negative) dhuku/loan cash flow
// for the given month — folded into Safe to Spend's totalActual alongside
// category expenses, since it's real money the household doesn't have
// available to spend (or does, in the case of a payout), even though it
// isn't a budgeted category.
export function netMonthlyOutflow(events: CashFlowEvent[], year: number, month: number, dateFormat: DateFormat): number {
  return events
    .filter((e) => dayNumberInPeriod(e.date, year, month, dateFormat) !== null)
    .reduce((sum, e) => sum + (e.direction === "out" ? e.amount : -e.amount), 0);
}

// (Remaining budget for the month) / (days left, inclusive of today) — a
// simple daily spending allowance, not a forecast. Clamped at 0 so an
// already-overspent month shows "NPR 0" instead of a negative number.
export function safeToSpendToday(
  totalPlanned: number,
  totalActual: number,
  year: number,
  month: number,
  dateFormat: DateFormat,
): number {
  const period = resolvePeriod(year, month, dateFormat);
  const current = currentPeriodYearMonth(dateFormat);
  const isCurrent = year === current.year && month === current.month;
  const daysLeft = isCurrent
    ? Math.max(1, period.daysInPeriod - daysElapsedInPeriod(period) + 1)
    : period.daysInPeriod;
  const remaining = totalPlanned - totalActual;
  return Math.max(0, Math.round(remaining / daysLeft));
}

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
