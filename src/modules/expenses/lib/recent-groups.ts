import type { DateFormat } from "@/lib/date-format-cookie";

import { groupByDay } from "./expense-view";

export type RecentRow = {
  amount: number;
  categoryGroupName: string;
  categoryIcon: null | string;
  categoryName: string;
  id: string;
  note: null | string;
};

export type RecentGroup = { key: string; label: string; rows: RecentRow[]; sub: string; total: number };

type ExpenseRecord = {
  amount: string;
  categoryId: string;
  date: string;
  id: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
};
type CategoryRecord = { groupName: string; icon: null | string; id: string; name: string };

// "Recent expenses" by day, as Home and the demo's phone both show them.
export function buildRecentGroups(
  rows: ExpenseRecord[],
  categories: CategoryRecord[],
  ctx: { dateFormat: DateFormat; today: string },
): RecentGroup[] {
  const category = (id: string) => categories.find((c) => c.id === id);
  return groupByDay(
    rows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      categoryName: category(e.categoryId)?.name ?? "Unknown",
      date: e.date,
      id: e.id,
      note: e.note,
      ownerMemberId: e.ownerMemberId,
      paidByMemberId: e.paidByMemberId,
    })),
    ctx,
  ).map((group) => ({
    key: group.date,
    label: group.label,
    rows: group.rows.map((row) => ({
      amount: row.amount,
      categoryGroupName: category(row.categoryId)?.groupName ?? "",
      categoryIcon: category(row.categoryId)?.icon ?? null,
      categoryName: row.categoryName,
      id: row.id,
      note: row.note,
    })),
    sub: group.sub,
    total: group.total,
  }));
}
