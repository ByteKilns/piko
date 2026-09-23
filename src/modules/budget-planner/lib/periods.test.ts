import { describe, expect, it } from "vitest";

import { periodBounds, periodKey, recentCompletedPeriods } from "./periods";

describe("recentCompletedPeriods", () => {
  it("returns the periods before the given one, oldest first", () => {
    expect(recentCompletedPeriods({ month: 4, year: 2083 }, 3)).toEqual([
      { month: 1, year: 2083 },
      { month: 2, year: 2083 },
      { month: 3, year: 2083 },
    ]);
  });

  it("crosses the year boundary", () => {
    expect(recentCompletedPeriods({ month: 1, year: 2026 }, 2)).toEqual([
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
    ]);
  });
});

describe("periodKey", () => {
  it("zero-pads the month", () => {
    expect(periodKey({ month: 4, year: 2083 })).toBe("2083-04");
  });
});

describe("periodBounds", () => {
  it("resolves an english month to AD dates", () => {
    expect(periodBounds({ month: 2, year: 2026 }, "english")).toMatchObject({
      endDate: "2026-02-28",
      startDate: "2026-02-01",
    });
  });

  it("resolves a nepali month to a valid AD range", () => {
    const bounds = periodBounds({ month: 1, year: 2083 }, "nepali");
    expect(bounds.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bounds.startDate <= bounds.endDate).toBe(true);
  });
});
