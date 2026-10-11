import { formatShortDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";

// Pure view logic for the Expenses page: owner totals for the headline
// figures, the filter bar, and the day groups the list is drawn from.

export type ExpenseItem = {
  amount: number;
  categoryId: string;
  categoryName: string;
  date: string; // YYYY-MM-DD
  id: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
};

export type OwnerTab = "all" | "me" | "partner" | "shared";
export type DateRange = "month" | "today" | "week";

export type ExpenseFilter = {
  categoryId: null | string;
  owner: OwnerTab;
  payerId: null | string;
  query: string;
  range: DateRange;
};

export const NO_FILTER: ExpenseFilter = { categoryId: null, owner: "all", payerId: null, query: "", range: "month" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ownerTotals(rows: ExpenseItem[], meId: string) {
  const totals = { all: 0, me: 0, partner: 0, shared: 0 };
  for (const row of rows) {
    totals[roleForOwner(row.ownerMemberId, meId)] += row.amount;
    totals.all += row.amount;
  }
  return totals;
}

export function filterExpenses<T extends ExpenseItem>(rows: T[], filter: ExpenseFilter, ctx: { meId: string; today: string }): T[] {
  const query = filter.query.trim().toLowerCase();
  const weekStart = addDays(ctx.today, -6);

  return rows.filter((row) => {
    if (filter.owner !== "all" && roleForOwner(row.ownerMemberId, ctx.meId) !== filter.owner) return false;
    if (filter.categoryId && row.categoryId !== filter.categoryId) return false;
    if (filter.payerId && row.paidByMemberId !== filter.payerId) return false;
    if (filter.range === "today" && row.date !== ctx.today) return false;
    if (filter.range === "week" && (row.date < weekStart || row.date > ctx.today)) return false;
    if (query && !`${row.categoryName} ${row.note ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

export type DayGroup<T> = { date: string; label: string; rows: T[]; sub: string; total: number };

// "Today" / "Yesterday" carry the date and weekday underneath; older days are
// named by weekday with just the date (as in the mockup).
export function groupByDay<T extends ExpenseItem>(rows: T[], ctx: { dateFormat: DateFormat; today: string }): DayGroup<T>[] {
  const byDate = new Map<string, T[]>();
  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  }

  const yesterday = addDays(ctx.today, -1);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayRows]) => {
      const weekday = WEEKDAYS[utcDate(date).getUTCDay()];
      const short = formatShortDate(date, ctx.dateFormat);
      // A Bikram Sambat household also sees the Gregorian date in brackets, so
      // expenses can be lined up with bank or English-dated records.
      const dated = ctx.dateFormat === "nepali" ? `${short} (${formatShortDate(date, "english")})` : short;
      const recent = date === ctx.today || date === yesterday;
      return {
        date,
        label: date === ctx.today ? "Today" : date === yesterday ? "Yesterday" : weekday,
        rows: dayRows,
        sub: recent ? `${dated}, ${weekday}` : dated,
        total: dayRows.reduce((sum, row) => sum + row.amount, 0),
      };
    });
}

// The categories offered as one-tap chips in the Add expense dialog.
export function topCategoryIds(rows: Pick<ExpenseItem, "categoryId">[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export function visibleNote(note: null | string, categoryName: string): string {
  const trimmed = note?.trim() ?? "";
  return trimmed.toLowerCase() === categoryName.trim().toLowerCase() ? "" : trimmed;
}
