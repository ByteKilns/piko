import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { recurringChanges, type RecurringSnapshot, recurringSummary } from "./recurring-activity";

const f = testFormatters();
const item: RecurringSnapshot = {
  amount: "1500.00",
  categoryId: "cat-1",
  endDate: null,
  frequency: "monthly",
  icon: "wifi",
  name: "Internet",
  nextDueDate: "2026-10-15",
  ownerMemberId: null,
  vendor: null,
};

describe("recurring activity", () => {
  it("summarises a recurring bill", () => {
    expect(recurringSummary(f, item)).toBe("Internet · RS 1,500 monthly · Groceries");
  });

  it("diffs recurring fields", () => {
    expect(recurringChanges(f, item, { ...item, amount: 1800, nextDueDate: "2026-10-20", vendor: "WorldLink" })).toEqual([
      { field: "Amount", from: "RS 1,500", to: "RS 1,800" },
      { field: "Next due", from: "15 October 2026", to: "20 October 2026" },
      { field: "Vendor", from: null, to: "WorldLink" },
    ]);
  });
});
