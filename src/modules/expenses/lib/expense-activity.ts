import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type ExpenseSnapshot = {
  amount: number | string;
  categoryId: string;
  date: string;
  note?: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
};

function expenseFields(f: ActivityFormatters): FieldSpec<ExpenseSnapshot>[] {
  return [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.category, key: "categoryId", label: "Category" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
}

// "Groceries · RS 1,200 · Shared — weekly veg"
export function expenseSummary(f: ActivityFormatters, expense: ExpenseSnapshot): string {
  const base = [f.category(expense.categoryId), f.money(expense.amount), f.owner(expense.ownerMemberId)]
    .filter(Boolean)
    .join(" · ");
  const note = f.text(expense.note);
  return note ? `${base} — ${note}` : base;
}

export function expenseChanges(f: ActivityFormatters, before: ExpenseSnapshot, after: ExpenseSnapshot) {
  return diffFields(before, after, expenseFields(f));
}
