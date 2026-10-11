import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { depositSummary, itemSummary, potSummary } from "./savings-activity";

const f = testFormatters();

describe("savings activity summaries", () => {
  it("summarises a pot", () => {
    expect(potSummary(f, { name: "Shared savings", ownerMemberId: null, reserveMinimum: "100000" })).toBe(
      "Shared savings · Shared · reserve RS 100,000",
    );
  });

  it("summarises a list item", () => {
    expect(itemSummary(f, { cost: 300000, name: "Surgery" }, "Shared savings")).toBe("Surgery · RS 300,000 · Shared savings");
  });

  it("names who put money in, or what kind of money it was", () => {
    expect(depositSummary(f, { amount: "10000", kind: "deposit", memberId: "m-1" }, "Shared savings")).toBe(
      "RS 10,000 into Shared savings · by Asha",
    );
    expect(depositSummary(f, { amount: 40000, kind: "opening", memberId: null }, "Shared savings")).toBe(
      "RS 40,000 into Shared savings · opening balance",
    );
  });
});
