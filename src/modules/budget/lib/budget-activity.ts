import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

import { LINE_KINDS } from "./plan-lines";

export type BudgetItemSnapshot = { categoryId: string; kind?: null | string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; kind?: string; memberId: string; month: number; note?: null | string; year: number };

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

function kindLabel(value: unknown): null | string {
  return LINE_KINDS.find((k) => k.value === value)?.label ?? null;
}

export function budgetItemFields(f: ActivityFormatters): FieldSpec<BudgetItemSnapshot>[] {
  return [
    { format: f.money, key: "plannedAmount", label: "Planned" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: kindLabel, key: "kind", label: "Kind" },
  ];
}

export function budgetItemChanges(f: ActivityFormatters, before: BudgetItemSnapshot, after: BudgetItemSnapshot) {
  return diffFields(before, after, budgetItemFields(f));
}

// "Ravi · Ashwin 2083 · RS 90,000", or "… · Extra · Dashain bonus" for extra income.
export function incomeSummary(f: ActivityFormatters, income: IncomeSnapshot): string {
  const extra = income.kind === "extra" ? ["Extra", f.text(income.note)] : [];
  return [f.member(income.memberId), f.period(income.year, income.month), f.money(income.amount), ...extra].filter(Boolean).join(" · ");
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
