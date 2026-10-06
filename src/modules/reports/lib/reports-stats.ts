import type { Tone } from "@/components/ToneIcon";
import type { DateFormat } from "@/lib/date-format-cookie";
import { previousMonth } from "@/lib/month-nav";
import { currentPeriodYearMonth, dayNumberInPeriod, daysElapsedInPeriod, formatPeriodShortLabel, resolvePeriod } from "@/lib/month-period";
import { getCategoryTone } from "@/modules/categories/lib/category-icons";

export function trendPct(current: number, previous: number): null | number {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type CategorySlice = { amount: number; categoryId: string; groupName: string; name: string; pct: number; tone: Tone };

export function categoryBreakdown(
  expenses: { amount: number; categoryId: string }[],
  categories: { groupName: string; id: string; name: string }[],
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [...totals.entries()]
    .map(([categoryId, amount]) => {
      const category = categoryById.get(categoryId);
      return {
        amount,
        categoryId,
        groupName: category?.groupName ?? "Other",
        name: category?.name ?? "Unknown",
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        tone: getCategoryTone(category?.groupName ?? "Other"),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type MonthPoint = { expenses: number; income: number; label: string };

export function monthlyIncomeExpenseTrend(
  incomeRows: { amount: number; month: number; year: number }[],
  expenseRows: { amount: number; date: string }[],
  end: { month: number; year: number },
  monthsBack: number,
  dateFormat: DateFormat,
): MonthPoint[] {
  const months: { month: number; year: number }[] = [end];
  for (let i = 1; i < monthsBack; i++) {
    months.unshift(previousMonth(months[0].year, months[0].month));
  }

  return months.map(({ month, year }) => {
    const income = incomeRows.filter((i) => i.year === year && i.month === month).reduce((s, i) => s + i.amount, 0);
    const expenseTotal = expenseRows
      .filter((e) => dayNumberInPeriod(e.date, year, month, dateFormat) !== null)
      .reduce((s, e) => s + e.amount, 0);
    return { expenses: expenseTotal, income, label: formatPeriodShortLabel(year, month, dateFormat) };
  });
}

export type PacePoint = { actual: null | number; day: number; pace: number };

// Cumulative actual spend vs. an even daily-pace line (budget spread evenly
// across the month), day by day. For the current month, `actual` stops at
// today (null afterward, so the line doesn't imply spending that hasn't
// happened yet); for a past month it runs the full length. `pace` always
// runs the full month as a reference line — it's meaningless without a
// budget, so callers should skip rendering it when totalPlanned <= 0.
export function dailySpendingPace(
  expenses: { amount: number; date: string }[],
  year: number,
  month: number,
  totalPlanned: number,
  dateFormat: DateFormat,
): PacePoint[] {
  const period = resolvePeriod(year, month, dateFormat);
  const current = currentPeriodYearMonth(dateFormat);
  const isCurrent = year === current.year && month === current.month;
  const lastActualDay = isCurrent ? daysElapsedInPeriod(period) : period.daysInPeriod;

  const spentByDay = new Map<number, number>();
  for (const e of expenses) {
    const day = dayNumberInPeriod(e.date, year, month, dateFormat);
    if (day === null) continue;
    spentByDay.set(day, (spentByDay.get(day) ?? 0) + e.amount);
  }

  const points: PacePoint[] = [];
  let cumulative = 0;
  for (let day = 1; day <= period.daysInPeriod; day++) {
    const withinActualRange = day <= lastActualDay;
    if (withinActualRange) cumulative += spentByDay.get(day) ?? 0;
    points.push({
      actual: withinActualRange ? Math.round(cumulative) : null,
      day,
      pace: Math.round((totalPlanned * day) / period.daysInPeriod),
    });
  }
  return points;
}

export function spendingInsight(currentExpenses: number, previousExpenses: number): string {
  const pct = trendPct(currentExpenses, previousExpenses);
  if (pct === null) return "Not enough history yet to compare against last month.";
  if (pct < 0) return `You're spending ${Math.abs(pct)}% less than last month. Great progress on your goals!`;
  if (pct > 0) return `You're spending ${pct}% more than last month. Consider reviewing your budget.`;
  return "Your spending is about the same as last month.";
}

type CategoryInfo = { groupName: string; id: string; name: string };

function sumByCategory(rows: { amount: number; categoryId: string }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.categoryId, (totals.get(r.categoryId) ?? 0) + r.amount);
  return totals;
}

function describeCategory(categoryId: string, categoryById: Map<string, CategoryInfo>) {
  const category = categoryById.get(categoryId);
  const groupName = category?.groupName ?? "Other";
  return { categoryId, groupName, name: category?.name ?? "Unknown", tone: getCategoryTone(groupName) };
}

export type BudgetLine = { categoryId: string; groupName: string; name: string; planned: number; spent: number; tone: Tone };

// Planned vs spent per category for one month. Budget lines are per owner, so
// a category's lines are summed. Overspent categories come first (worst
// first), then spending with no budget (largest first), then the rest by how
// much of their budget is used.
export function budgetVsActual(
  budgetItems: { categoryId: string; plannedAmount: number }[],
  expenses: { amount: number; categoryId: string }[],
  categories: CategoryInfo[],
): BudgetLine[] {
  const planned = sumByCategory(budgetItems.map((b) => ({ amount: b.plannedAmount, categoryId: b.categoryId })));
  const spent = sumByCategory(expenses);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const lines = [...new Set([...planned.keys(), ...spent.keys()])].map((categoryId) => ({
    ...describeCategory(categoryId, categoryById),
    planned: planned.get(categoryId) ?? 0,
    spent: spent.get(categoryId) ?? 0,
  }));
  const rank = (l: BudgetLine) => (l.planned === 0 ? 1 : l.spent > l.planned ? 0 : 2);
  const weight = (l: BudgetLine) => [l.spent - l.planned, l.spent, l.spent / l.planned][rank(l)];
  return lines
    .filter((l) => l.planned > 0 || l.spent > 0)
    .sort((a, b) => rank(a) - rank(b) || weight(b) - weight(a));
}

export type CategoryChange = {
  categoryId: string;
  current: number;
  delta: number;
  groupName: string;
  name: string;
  pct: null | number;
  previous: number;
  tone: Tone;
};

// The categories whose spending moved most vs the previous month, either way.
export function categoryChanges(
  current: { amount: number; categoryId: string }[],
  previous: { amount: number; categoryId: string }[],
  categories: CategoryInfo[],
  limit = 5,
): CategoryChange[] {
  const now = sumByCategory(current);
  const before = sumByCategory(previous);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return [...new Set([...now.keys(), ...before.keys()])]
    .map((categoryId) => {
      const cur = now.get(categoryId) ?? 0;
      const prev = before.get(categoryId) ?? 0;
      return { ...describeCategory(categoryId, categoryById), current: cur, delta: cur - prev, pct: trendPct(cur, prev), previous: prev };
    })
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

export function topExpenses<T extends { amount: number }>(rows: T[], limit = 5): T[] {
  return [...rows].sort((a, b) => b.amount - a.amount).slice(0, limit);
}
