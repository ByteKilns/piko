import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import calendar from "@/lib/bs-calendar-data.json";
import { adToBs, BS_MAX_YEAR, BS_MIN_YEAR, bsToAd, daysInBsMonth, formatBsDate } from "@/lib/nepali-date";

describe("adToBs / bsToAd", () => {
  // Published calendar anchors. Each verified year's Baisakh 1 is pinned here
  // so a later edit to bs-calendar-data.json that breaks it fails loudly.
  it.each([
    ["2024-04-13", 2081, 1, 1],
    ["2025-04-14", 2082, 1, 1],
    ["2026-04-14", 2083, 1, 1],
    ["2025-09-17", 2082, 6, 1],
    ["2025-10-18", 2082, 7, 1],
    ["2026-09-17", 2083, 6, 1],
    ["2026-10-05", 2083, 6, 19],
  ])("%s is %i-%i-%i BS", (ad, year, month, day) => {
    expect(adToBs(ad)).toEqual({ day, month, year });
    expect(bsToAd(year, month, day)).toBe(ad);
  });

  // bikram-sambat-js gave Ashwin 2083 30 days, putting Kartik 1 on Oct 17.
  it("Ashwin 2083 has 31 days and Kartik 1 2083 is 2026-10-18", () => {
    expect(daysInBsMonth(2083, 6)).toBe(31);
    expect(adToBs("2026-10-17")).toEqual({ day: 31, month: 6, year: 2083 });
    expect(bsToAd(2083, 7, 1)).toBe("2026-10-18");
  });

  // bikram-sambat-js's AD->BS and BS->AD disagreed for 143 days in 2024-2026,
  // which made the date picker's value drift each time it re-rendered.
  it("round-trips every day across the supported range", () => {
    const start = Date.UTC(1913, 3, 13);
    const end = Date.UTC(2044, 3, 12);
    for (let t = start; t <= end; t += 86_400_000) {
      const ad = new Date(t).toISOString().slice(0, 10);
      const { day, month, year } = adToBs(ad);
      expect(bsToAd(year, month, day)).toBe(ad);
    }
  });

  it("throws a RangeError outside the table", () => {
    expect(() => adToBs("1913-04-12")).toThrow(RangeError);
    expect(() => bsToAd(BS_MAX_YEAR + 1, 1, 1)).toThrow(RangeError);
    expect(() => bsToAd(BS_MIN_YEAR, 1, 0)).toThrow(RangeError);
    expect(() => bsToAd(2083, 6, 32)).toThrow(RangeError);
  });
});

describe("formatBsDate", () => {
  it("formats with the BS month name", () => {
    expect(formatBsDate("2026-10-05")).toBe("19 Ashwin 2083");
  });
});

describe("mobile bundled calendar", () => {
  // The app falls back to its bundled copy when /api/mobile/calendar is
  // unreachable, so it must never drift from the web's table.
  it("is identical to the web's table", () => {
    const bundled = JSON.parse(readFileSync(join(process.cwd(), "mobile/assets/bs_calendar.json"), "utf8"));
    expect(bundled).toEqual(calendar);
  });
});
