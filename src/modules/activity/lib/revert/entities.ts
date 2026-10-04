import type { ActivityEntityType, ActivitySnapshot } from "@/db/schema";
import { budgetItemFields, incomeFields } from "@/modules/budget/lib/budget-activity";
import { categoryFields, type CategorySnapshot, categorySummary } from "@/modules/categories/lib/category-activity";
import { dhukuEntryFields, dhukuFields, type DhukuSnapshot, dhukuSummary } from "@/modules/dhuku/lib/dhuku-activity";
import { expenseFields, type ExpenseSnapshot, expenseSummary } from "@/modules/expenses/lib/expense-activity";
import { loanFields, loanPaymentFields, type LoanSnapshot, loanSummary } from "@/modules/loans/lib/loan-activity";
import { recurringFields, type RecurringSnapshot, recurringSummary } from "@/modules/recurring/lib/recurring-activity";
import { contributionFields, goalFields, goalSummary, type SavingsGoalSnapshot } from "@/modules/savings-goals/lib/savings-activity";
import { dateFormatLabel, settingsFields } from "@/modules/settings/lib/settings-activity";

import type { ActivityFormatters } from "../activity-values";
import type { FieldSpec } from "../diff";

type Row = ActivitySnapshot;

export type ChildKind = { kind: string; removed?: (n: number) => string; restored?: (n: number) => string };

export type EntityRevert = {
  children: ChildKind[];
  editable: string[];
  fields: (f: ActivityFormatters) => FieldSpec<Row>[];
  noun: string;
  // Fields whose formatted value can't show a difference, so they compare raw.
  opaque?: string[];
  parentNoun?: string;
  references: (row: Row) => { categoryIds: string[]; memberIds: string[]; parentId?: string };
  summary: (f: ActivityFormatters, row: Row) => string;
};

const ids = (...values: unknown[]) => values.filter((v): v is string => typeof v === "string");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capitalized = (v: unknown) => (typeof v === "string" && v ? v[0].toUpperCase() + v.slice(1) : null);
const noRefs = () => ({ categoryIds: [], memberIds: [] });
// Each module types its specs against its own snapshot; the planner reads them
// against an untyped row, where every key is just a string.
const rowFields = <T>(specs: FieldSpec<T>[]): FieldSpec<Row>[] => specs.map(({ format, key, label }) => ({ format, key, label }));

// Per entity type: which columns a revert may write, how to display them, and
// what else a delete takes along. Keys mirror the Drizzle field names.
export const ENTITY_REVERT: Partial<Record<ActivityEntityType, EntityRevert>> = {
  budget_item: {
    children: [],
    editable: ["ownerMemberId", "plannedAmount"],
    fields: (f) => [{ format: f.category, key: "categoryId", label: "Category" }, ...rowFields(budgetItemFields(f))],
    noun: "budget line",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => [f.category(r.categoryId), f.owner(r.ownerMemberId), f.money(r.plannedAmount)].filter(Boolean).join(" · "),
  },
  category: {
    children: [],
    editable: ["archived", "budgetType", "groupName", "name"],
    fields: () => [...rowFields(categoryFields()), { format: (v) => (v ? "Archived" : "Active"), key: "archived", label: "Status" }],
    noun: "category",
    references: noRefs,
    summary: (_, r) => categorySummary(r as CategorySnapshot),
  },
  dhuku: {
    children: [
      {
        kind: "dhukuEntries",
        removed: (n) => `This also removes ${plural(n, "entry", "entries")}.`,
        restored: (n) => `Also brings back ${plural(n, "entry", "entries")}.`,
      },
    ],
    editable: ["interestPerMonth", "monthlyContribution", "name", "note", "ownerMemberId", "startDate", "totalMembers"],
    fields: (f) => rowFields(dhukuFields(f)),
    noun: "dhuku",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => dhukuSummary(f, r as DhukuSnapshot),
  },
  dhuku_entry: {
    children: [],
    editable: ["amount", "date", "note", "type"],
    fields: (f) => rowFields(dhukuEntryFields(f)),
    noun: "dhuku entry",
    parentNoun: "dhuku",
    references: (r) => ({ categoryIds: [], memberIds: [], parentId: String(r.dhukuId) }),
    summary: (f, r) => `${r.type === "payout" ? "Payout" : "Contribution"} · ${f.money(r.amount)}`,
  },
  expense: {
    children: [],
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId"],
    fields: (f) => rowFields(expenseFields(f)),
    noun: "expense",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId, r.paidByMemberId) }),
    summary: (f, r) => expenseSummary(f, r as ExpenseSnapshot),
  },
  household_settings: {
    children: [],
    editable: ["dateFormat", "plannerEnabled"],
    fields: () => rowFields(settingsFields()),
    noun: "household setting",
    references: noRefs,
    summary: (_, r) =>
      "dateFormat" in r ? `Date format → ${dateFormatLabel(r.dateFormat)}` : `AI budget planner → ${r.plannerEnabled ? "On" : "Off"}`,
  },
  income: {
    children: [],
    editable: ["amount", "note"],
    fields: (f) => rowFields(incomeFields(f)),
    noun: "income entry",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId) }),
    summary: (f, r) => [f.member(r.memberId), f.money(r.amount)].filter(Boolean).join(" · "),
  },
  loan: {
    children: [
      {
        kind: "loanPayments",
        removed: (n) => `This also removes ${plural(n, "payment")}.`,
        restored: (n) => `Also brings back ${plural(n, "payment")}.`,
      },
    ],
    editable: [
      "counterpartyName",
      "date",
      "direction",
      "dueDate",
      "installmentAmount",
      "installmentFrequency",
      "nextInstallmentDate",
      "note",
      "ownerMemberId",
      "principalAmount",
    ],
    fields: (f) => rowFields(loanFields(f)),
    noun: "loan",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => loanSummary(f, r as LoanSnapshot),
  },
  loan_payment: {
    children: [],
    editable: ["amount", "date", "memberId", "note"],
    fields: (f) => rowFields(loanPaymentFields(f)),
    noun: "loan payment",
    parentNoun: "loan",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId), parentId: String(r.loanId) }),
    summary: (f, r) => `${f.money(r.amount)} · by ${f.member(r.memberId)}`,
  },
  recurring_expense: {
    children: [{ kind: "linkedExpenseIds", restored: (n) => `Also re-links ${plural(n, "expense")} to it.` }],
    editable: ["amount", "categoryId", "endDate", "frequency", "icon", "name", "nextDueDate", "ownerMemberId", "status", "vendor"],
    fields: (f) => [...rowFields(recurringFields(f)), { format: capitalized, key: "status", label: "Status" }],
    noun: "recurring bill",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => recurringSummary(f, r as RecurringSnapshot),
  },
  savings_contribution: {
    children: [],
    editable: ["amount", "date", "memberId"],
    fields: (f) => rowFields(contributionFields(f)),
    noun: "contribution",
    parentNoun: "savings goal",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId), parentId: String(r.goalId) }),
    summary: (f, r) => `${f.money(r.amount)} · by ${f.member(r.memberId)}`,
  },
  savings_goal: {
    children: [
      {
        kind: "contributions",
        removed: (n) => `This also removes ${plural(n, "contribution")}.`,
        restored: (n) => `Also brings back ${plural(n, "contribution")}.`,
      },
    ],
    editable: ["description", "image", "name", "ownerMemberId", "targetAmount", "targetDate"],
    fields: (f) => [...rowFields(goalFields(f)), { format: (v) => (v ? "Photo" : null), key: "image", label: "Photo" }],
    noun: "savings goal",
    opaque: ["image"],
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => goalSummary(f, r as SavingsGoalSnapshot),
  },
};
