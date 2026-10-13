import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { fundChanges, fundSummary, topUpSummary } from "./fund-activity";

const f = testFormatters();
const fund = { dueMonth: 10, dueYear: 2027, monthlyAmount: "1225.00", name: "WorldLink", ownerMemberId: "m-1", target: "14690.00" };

describe("fund activity", () => {
  it("summarises a fund with its owner and monthly set-aside", () => {
    expect(fundSummary(f, fund)).toBe("WorldLink · Asha · RS 1,225 a month");
  });

  it("diffs the monthly amount, target and due month", () => {
    expect(fundChanges(f, fund, { ...fund, dueMonth: 11, monthlyAmount: 1500, target: 14690 })).toEqual([
      { field: "Monthly", from: "RS 1,225", to: "RS 1,500" },
      { field: "Needed by", from: "October 2027", to: "November 2027" },
    ]);
  });

  it("summarises money added to a fund", () => {
    expect(topUpSummary(f, { amount: "5000.00", note: "Dashain bonus" }, "Festivals")).toBe("Festivals · RS 5,000 added · Dashain bonus");
  });
});
