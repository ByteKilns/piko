import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { dhukuChanges, dhukuEntrySummary, type DhukuSnapshot, dhukuSummary } from "./dhuku-activity";

const f = testFormatters();
const dhuku: DhukuSnapshot = {
  interestPerMonth: null,
  monthlyContribution: "10000.00",
  name: "Office dhuku",
  note: null,
  ownerMemberId: null,
  startDate: "2026-01-01",
  totalMembers: 12,
};

describe("dhuku activity", () => {
  it("summarises a dhuku", () => {
    expect(dhukuSummary(f, dhuku)).toBe("Office dhuku · RS 10,000/month · 12 members");
  });

  it("diffs dhuku fields", () => {
    expect(dhukuChanges(f, dhuku, { ...dhuku, interestPerMonth: 500, totalMembers: 10 })).toEqual([
      { field: "Members", from: "12", to: "10" },
      { field: "Interest per month", from: null, to: "RS 500" },
    ]);
  });

  it("summarises an entry by type", () => {
    expect(dhukuEntrySummary(f, { amount: "120000.00", type: "payout" }, "Office dhuku")).toBe("Payout · RS 120,000 · Office dhuku");
    expect(dhukuEntrySummary(f, { amount: 10000, type: "contribution" }, "Office dhuku")).toBe(
      "Contribution · RS 10,000 · Office dhuku",
    );
  });
});
