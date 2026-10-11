// src/modules/dashboard/lib/cash-flow.test.ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import { allowanceSpentByDay, daysLeftInMonth } from "./cash-flow";

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
    expect(daysLeftInMonth(2020, 2, "english")).toBe(29); // Feb 2020 is a leap year
  });

  it("returns the full day count for a 30-day past month", () => {
    expect(daysLeftInMonth(2020, 4, "english")).toBe(30);
  });
});

describe("allowanceSpentByDay", () => {
  const fixedCategoryIds = new Set(["rent"]);

  it("adds up non-fixed expenses by day and leaves fixed ones out", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "200", categoryId: "groceries", date: "2026-02-03" },
        { amount: "150.50", categoryId: "petrol", date: "2026-02-03" },
        { amount: "25000", categoryId: "rent", date: "2026-02-02" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent).toHaveLength(28); // Feb 2026 is not a leap year
    expect(spent[1]).toBe(0); // rent on day 2 is a fixed bill, so it doesn't count
    expect(spent[2]).toBe(350.5);
    expect(spent.reduce((sum, value) => sum + value, 0)).toBe(350.5);
  });

  it("still counts an expense whose category isn't known to be fixed", () => {
    const spent = allowanceSpentByDay(
      [{ amount: "500", categoryId: "archived-category", date: "2026-02-10" }],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent[9]).toBe(500);
  });

  it("ignores expenses outside the month", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "1000", categoryId: "groceries", date: "2026-01-31" },
        { amount: "1000", categoryId: "groceries", date: "2026-03-01" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent.every((value) => value === 0)).toBe(true);
  });

  it("uses the Nepali month's own days when the household uses BS dates", () => {
    const period = resolvePeriod(2083, 6, "nepali");
    const spent = allowanceSpentByDay(
      [
        { amount: "100", categoryId: "groceries", date: period.startDate },
        { amount: "300", categoryId: "groceries", date: period.endDate },
      ],
      fixedCategoryIds,
      2083,
      6,
      "nepali",
    );

    expect(spent).toHaveLength(period.daysInPeriod);
    expect(spent[0]).toBe(100);
    expect(spent[period.daysInPeriod - 1]).toBe(300);
  });
});
