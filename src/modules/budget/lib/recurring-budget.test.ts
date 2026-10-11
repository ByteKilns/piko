import { describe, expect, it } from "vitest";

import { type RecurringBill, recurringBudgetLines } from "./recurring-budget";

const OCTOBER = { endDate: "2026-10-31", startDate: "2026-10-01" };

function bill(overrides: Partial<RecurringBill>): RecurringBill {
  return { amount: 1000, categoryId: "internet", frequency: "monthly", nextDueDate: "2026-10-10", ownerMemberId: null, status: "active", ...overrides };
}

describe("recurringBudgetLines", () => {
  it("includes every active monthly bill", () => {
    expect(recurringBudgetLines([bill({ amount: 3000 })], OCTOBER)).toEqual([{ categoryId: "internet", ownerMemberId: null, plannedAmount: 3000 }]);
  });

  it("includes a quarterly or yearly bill only in the month it's due", () => {
    const lines = recurringBudgetLines(
      [
        bill({ amount: 9000, categoryId: "insurance", frequency: "quarterly", nextDueDate: "2026-10-20" }),
        bill({ amount: 12000, categoryId: "tax", frequency: "yearly", nextDueDate: "2027-04-01" }),
      ],
      OCTOBER,
    );

    expect(lines).toEqual([{ categoryId: "insurance", ownerMemberId: null, plannedAmount: 9000 }]);
  });

  it("leaves out paused and completed bills", () => {
    expect(recurringBudgetLines([bill({ status: "paused" }), bill({ status: "completed" })], OCTOBER)).toEqual([]);
  });

  it("adds up bills that share a category and owner", () => {
    const lines = recurringBudgetLines(
      [bill({ amount: 1000, ownerMemberId: "me" }), bill({ amount: 500, ownerMemberId: "me" }), bill({ amount: 700, ownerMemberId: null })],
      OCTOBER,
    );

    expect(lines).toEqual([
      { categoryId: "internet", ownerMemberId: "me", plannedAmount: 1500 },
      { categoryId: "internet", ownerMemberId: null, plannedAmount: 700 },
    ]);
  });
});
