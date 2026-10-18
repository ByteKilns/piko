import { formatMoney } from "@/lib/money";
import type { BudgetLine, CategoryChange } from "@/modules/reports/lib/reports-stats";
import { trendPct } from "@/modules/reports/lib/reports-stats";

// Pure builder for the Expenses report's lead sentence (spec §3.7). Names the
// category that moved most and/or is furthest over budget, if either stands out.

export type ExpenseLead = { exceptionRest: string; exceptionStrong: string; overall: string };

export function expenseLead(input: {
  budgetLines: BudgetLine[];
  changes: CategoryChange[];
  current: number;
  previous: number;
  prevMonthName: string;
}): ExpenseLead {
  const { budgetLines, changes, current, prevMonthName, previous } = input;
  const pct = trendPct(current, previous);

  let overall: string;
  if (pct === null) overall = `There isn't enough history yet to compare with ${prevMonthName}.`;
  else if (Math.abs(pct) < 5) overall = `Overall, spending is about the same as ${prevMonthName}.`;
  else overall = `Overall, spending is ${Math.abs(pct)}% ${pct > 0 ? "more" : "less"} than ${prevMonthName}.`;

  const biggestUp = changes.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta)[0] ?? null;
  const biggestOver =
    budgetLines
      .filter((l) => l.spent > l.planned)
      .sort((a, b) => b.spent - b.planned - (a.spent - a.planned))[0] ?? null;

  const exceptionStrong = biggestUp?.name ?? biggestOver?.name ?? "";
  let exceptionRest = "";
  if (biggestUp && biggestOver && biggestUp.categoryId === biggestOver.categoryId) {
    exceptionRest = ` is the exception: up ${formatMoney(biggestUp.delta)} on last month, and ${formatMoney(biggestOver.spent - biggestOver.planned)} over its budget.`;
  } else if (biggestUp) {
    exceptionRest = ` moved the most: up ${formatMoney(biggestUp.delta)} on last month.`;
  } else if (biggestOver) {
    exceptionRest = ` is ${formatMoney(biggestOver.spent - biggestOver.planned)} over its budget.`;
  }

  return { exceptionRest, exceptionStrong, overall };
}

// Where a chart's marker label goes: to the right of a marker in the left
// half, to its left in the right half, so it never runs past the chart's
// edge (which made the whole page scroll sideways). `align` lines the label's
// text up with the marker side.
export type ChartLabelPosition =
  | { align: "end"; style: { right: string } }
  | { align: "start"; style: { left: string } };

export function chartLabelPosition(day: number, daysInPeriod: number, gapPx: number): ChartLabelPosition {
  if (day / daysInPeriod <= 0.5) {
    return { align: "start", style: { left: `calc(${(day / daysInPeriod) * 100}% + ${gapPx}px)` } };
  }
  return { align: "end", style: { right: `calc(${((daysInPeriod - day) / daysInPeriod) * 100}% + ${gapPx}px)` } };
}

// The Spending pace marker: how far up the chart the running total sits (a
// CSS `bottom`, so higher totals sit higher), where its label goes, and what
// to call it — a month that's over has no "today". The label sits just above
// the point: the running total only goes up, so the line to its left is never
// above it, and to its right nothing is drawn yet (the chart leaves room above
// its top for a total near the top).
export function paceMarker(input: { isCurrent: boolean; value: number; yMax: number }): {
  bottom: string;
  caption: string;
  labelBottom: string;
} {
  const pct = (input.value / input.yMax) * 100;
  return { bottom: `${pct}%`, caption: input.isCurrent ? "Today" : "Month end", labelBottom: `calc(${pct}% + 8px)` };
}
