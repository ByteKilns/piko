// src/modules/dashboard/lib/cash-flow.test.ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import { daysLeftInMonth, spentByDayIn } from "./cash-flow";

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
    expect(daysLeftInMonth(2020, 2, "english")).toBe(29); // Feb 2020 is a leap year
  });

  it("returns the full day count for a 30-day past month", () => {
    expect(daysLeftInMonth(2020, 4, "english")).toBe(30);
  });
});

describe("spentByDayIn", () => {
  const canCut = new Set(["lunch", "shopping"]);

  it("adds up spending in the given categories by day and leaves the rest out", () => {
    const spent = spentByDayIn(
      [
        { amount: "200", categoryId: "lunch", date: "2026-02-03" },
        { amount: 150.5, categoryId: "shopping", date: "2026-02-03" },
        { amount: "25000", categoryId: "rent", date: "2026-02-02" },
        { amount: "3000", categoryId: "petrol", date: "2026-02-03" },
      ],
      canCut,
      2026,
      2,
      "english",
    );

    expect(spent).toHaveLength(28); // Feb 2026 is not a leap year
    expect(spent[1]).toBe(0); // rent isn't a can-cut category
    expect(spent[2]).toBe(350.5);
    expect(spent.reduce((sum, value) => sum + value, 0)).toBe(350.5);
  });

  it("ignores expenses outside the month", () => {
    const spent = spentByDayIn(
      [
        { amount: "1000", categoryId: "lunch", date: "2026-01-31" },
        { amount: "1000", categoryId: "lunch", date: "2026-03-01" },
      ],
      canCut,
      2026,
      2,
      "english",
    );

    expect(spent.every((value) => value === 0)).toBe(true);
  });

  it("uses the Nepali month's own days when the household uses BS dates", () => {
    const period = resolvePeriod(2083, 6, "nepali");
    const spent = spentByDayIn(
      [
        { amount: "100", categoryId: "lunch", date: period.startDate },
        { amount: "300", categoryId: "lunch", date: period.endDate },
      ],
      canCut,
      2083,
      6,
      "nepali",
    );

    expect(spent).toHaveLength(period.daysInPeriod);
    expect(spent[0]).toBe(100);
    expect(spent[period.daysInPeriod - 1]).toBe(300);
  });
});
