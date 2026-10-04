import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { expenseChanges, type ExpenseSnapshot, expenseSummary } from "./expense-activity";

const f = testFormatters();
const stored: ExpenseSnapshot = {
  amount: "1200.00",
  categoryId: "cat-1",
  date: "2026-08-15",
  note: "weekly veg",
  ownerMemberId: null,
  paidByMemberId: "m-1",
};

describe("expense activity", () => {
  it("summarises category, amount, owner and note", () => {
    expect(expenseSummary(f, stored)).toBe("Groceries · RS 1,200 · Shared — weekly veg");
    expect(expenseSummary(f, { ...stored, note: null, ownerMemberId: "m-2" })).toBe("Groceries · RS 1,200 · Ravi");
  });

  it("diffs the editable fields with readable values", () => {
    const changes = expenseChanges(f, stored, { ...stored, amount: 1500, categoryId: "cat-2", ownerMemberId: "m-1" });
    expect(changes).toEqual([
      { field: "Amount", from: "RS 1,200", to: "RS 1,500" },
      { field: "Category", from: "Groceries", to: "Dining" },
      { field: "For", from: "Shared", to: "Asha" },
    ]);
  });

  it("reports no changes when the form is saved untouched", () => {
    expect(expenseChanges(f, stored, { ...stored, amount: 1200 })).toEqual([]);
  });
});
