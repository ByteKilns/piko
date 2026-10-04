import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "./budget-activity";

const f = testFormatters();

describe("budget activity", () => {
  it("summarises a budget line with its period", () => {
    const item = { categoryId: "cat-1", ownerMemberId: null, plannedAmount: 8000 };
    expect(budgetItemSummary(f, item, { month: 10, year: 2026 })).toBe("Groceries · Shared · October 2026 · RS 8,000");
  });

  it("diffs planned amount and owner", () => {
    const before = { categoryId: "cat-1", ownerMemberId: null, plannedAmount: "8000.00" };
    expect(budgetItemChanges(f, before, { ...before, ownerMemberId: "m-1", plannedAmount: 9000 })).toEqual([
      { field: "Planned", from: "RS 8,000", to: "RS 9,000" },
      { field: "For", from: "Shared", to: "Asha" },
    ]);
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
    expect(incomeChanges(f, before, { ...before, amount: 95000, note: "bonus" })).toEqual([
      { field: "Amount", from: "RS 90,000", to: "RS 95,000" },
      { field: "Note", from: null, to: "bonus" },
    ]);
  });
});
