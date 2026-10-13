import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { cushionSummary, settlementSummary } from "./cushion-activity";

const f = testFormatters();

describe("cushion activity", () => {
  it("summarises how a month's leftover was split", () => {
    expect(
      settlementSummary(f, { amount: 4200, month: 10, year: 2026 }, [
        { amount: 2000, label: "Shared savings" },
        { amount: 0, label: "WorldLink fund" },
        { amount: 2200, label: "kept" },
      ]),
    ).toBe("October 2026 · RS 4,200 left · Shared savings RS 2,000 · kept RS 2,200");
  });

  it("summarises a month that went over", () => {
    expect(settlementSummary(f, { amount: -2000, month: 10, year: 2026 }, [])).toBe(
      "October 2026 · went over by RS 2,000, taken from the cushion",
    );
  });

  it("summarises a month that came out even", () => {
    expect(settlementSummary(f, { amount: 0, month: 10, year: 2026 }, [])).toBe("October 2026 · came out even");
  });

  it("summarises the cushion with its target", () => {
    expect(cushionSummary(f, { balance: 20000, target: 30000 })).toBe("Cushion · RS 20,000 · aiming for RS 30,000");
    expect(cushionSummary(f, { balance: 0, target: null })).toBe("Cushion · RS 0");
  });
});
