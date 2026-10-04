import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type BudgetItemSnapshot = { categoryId: string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
export function budgetItemSummary(
  f: ActivityFormatters,
  item: BudgetItemSnapshot,
  period: { month: number; year: number },
): string {
  return [f.category(item.categoryId), f.owner(item.ownerMemberId), f.period(period.year, period.month), f.money(item.plannedAmount)]
    .filter(Boolean)
    .join(" · ");
}

export function budgetItemFields(f: ActivityFormatters): FieldSpec<BudgetItemSnapshot>[] {
  return [
    { format: f.money, key: "plannedAmount", label: "Planned" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
  ];
}

export function budgetItemChanges(f: ActivityFormatters, before: BudgetItemSnapshot, after: BudgetItemSnapshot) {
  return diffFields(before, after, budgetItemFields(f));
}

// "Ravi · Ashwin 2083 · RS 90,000"
export function incomeSummary(f: ActivityFormatters, income: IncomeSnapshot): string {
  return [f.member(income.memberId), f.period(income.year, income.month), f.money(income.amount)].filter(Boolean).join(" · ");
}

export function incomeFields(f: ActivityFormatters): FieldSpec<IncomeSnapshot>[] {
  return [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.text, key: "note", label: "Note" },
  ];
}

export function incomeChanges(f: ActivityFormatters, before: IncomeSnapshot, after: IncomeSnapshot) {
  return diffFields(before, after, incomeFields(f));
}
