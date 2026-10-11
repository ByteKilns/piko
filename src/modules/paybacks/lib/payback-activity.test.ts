import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { paybackSummary } from "./payback-activity";

const f = testFormatters();

describe("paybackSummary", () => {
  it("names who paid back whom, and how much", () => {
    expect(paybackSummary(f, { amount: "5000", fromMemberId: "m-1", toMemberId: "m-2" })).toBe("Asha paid back RS 5,000 to Ravi");
  });
});
