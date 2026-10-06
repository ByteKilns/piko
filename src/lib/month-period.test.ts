import { describe, expect, it } from "vitest";

import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  daysElapsedInPeriod,
  formatPeriodLabel,
  isCurrentPeriod,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "./month-period";

describe("resolvePeriod", () => {
  it("resolves a plain AD month in english mode", () => {
    expect(resolvePeriod(2026, 8, "english")).toEqual({
      daysInPeriod: 31,
      endDate: "2026-08-31",
      month: 8,
      startDate: "2026-08-01",
      year: 2026,
    });
  });

  it("resolves a real BS month spanning two AD months, in nepali mode", () => {
    // Bhadra 2083 — verified against the published 2083 calendar.
    expect(resolvePeriod(2083, 5, "nepali")).toEqual({
      daysInPeriod: 31,
      endDate: "2026-09-16",
      month: 5,
      startDate: "2026-08-17",
      year: 2083,
    });
  });

  it("resolves correctly across the BS year boundary (Chaitra -> Baisakh)", () => {
    // Chaitra 2082 (month 12) — next period is Baisakh 2083 (year rolls).
    expect(resolvePeriod(2082, 12, "nepali")).toEqual({
      daysInPeriod: 30,
      endDate: "2026-04-13",
      month: 12,
      startDate: "2026-03-15",
      year: 2082,
    });
  });
});

describe("MAX_NAVIGABLE_YEAR / MIN_NAVIGABLE_YEAR bounds", () => {
  // Regression test: the BS converter throws a RangeError outside its table
  // (BS 1970-2100). Before these bounds existed, an old cached URL with an
  // out-of-range ?year= could crash the page instead of gracefully falling
  // back to the current period — this happened for real during development
  // at the December boundary of the last BS year. These bounds must resolve without
  // throwing, at every corner.
  it("resolves without throwing at the nepali max year, December (the boundary that crashed)", () => {
    expect(() => resolvePeriod(MAX_NAVIGABLE_YEAR.nepali, 12, "nepali")).not.toThrow();
  });

  it("resolves without throwing at the nepali min year, January", () => {
    expect(() => resolvePeriod(MIN_NAVIGABLE_YEAR.nepali, 1, "nepali")).not.toThrow();
  });

  it("resolves without throwing at the english max/min year boundaries", () => {
    expect(() => resolvePeriod(MAX_NAVIGABLE_YEAR.english, 12, "english")).not.toThrow();
    expect(() => resolvePeriod(MIN_NAVIGABLE_YEAR.english, 1, "english")).not.toThrow();
  });
});

describe("dayNumberInPeriod", () => {
  it("returns the AD day-of-month in english mode", () => {
    expect(dayNumberInPeriod("2026-08-17", 2026, 8, "english")).toBe(17);
  });

  it("returns null when the date falls outside the given AD month", () => {
    expect(dayNumberInPeriod("2026-09-01", 2026, 8, "english")).toBeNull();
  });

  it("returns the BS day-of-month for a date inside the BS period", () => {
    // 2026-08-17 AD is Bhadra 1, 2083 — the first day of the period.
    expect(dayNumberInPeriod("2026-08-17", 2083, 5, "nepali")).toBe(1);
    // 2026-09-16 AD is Bhadra 31, 2083 — the last day of the period.
    expect(dayNumberInPeriod("2026-09-16", 2083, 5, "nepali")).toBe(31);
  });

  it("returns null when the date falls outside the given BS month", () => {
    // 2026-09-17 AD is Ashwin 1, 2083 — the day after Bhadra ends.
    expect(dayNumberInPeriod("2026-09-17", 2083, 5, "nepali")).toBeNull();
  });
});

describe("isCurrentPeriod / currentPeriodYearMonth / daysElapsedInPeriod", () => {
  it("currentPeriodYearMonth returns a BS year/month pair in nepali mode", () => {
    const { month, year } = currentPeriodYearMonth("nepali");
    expect(year).toBeGreaterThan(2000); // sanity: it's a BS year, not AD
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it("isCurrentPeriod agrees with currentPeriodYearMonth for both calendars", () => {
    const nepaliNow = currentPeriodYearMonth("nepali");
    expect(isCurrentPeriod(nepaliNow.year, nepaliNow.month, "nepali")).toBe(true);
    expect(isCurrentPeriod(nepaliNow.year, nepaliNow.month + 100, "nepali")).toBe(false);

    const englishNow = currentPeriodYearMonth("english");
    expect(isCurrentPeriod(englishNow.year, englishNow.month, "english")).toBe(true);
  });

  it("daysElapsedInPeriod is between 1 and daysInPeriod for the current period", () => {
    const { month, year } = currentPeriodYearMonth("nepali");
    const period = resolvePeriod(year, month, "nepali");
    const elapsed = daysElapsedInPeriod(period);
    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThanOrEqual(period.daysInPeriod);
  });
});

describe("formatPeriodLabel", () => {
  it("formats a plain english month/year", () => {
    expect(formatPeriodLabel(2026, 8, "english")).toBe("August 2026");
  });

  it("formats a plain nepali month/year — no range, the period IS one real month", () => {
    expect(formatPeriodLabel(2083, 5, "nepali")).toBe("Bhadra 2083");
  });
});
