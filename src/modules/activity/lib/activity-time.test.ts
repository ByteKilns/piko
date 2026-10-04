import { describe, expect, it } from "vitest";

import { formatKathmanduTime, kathmanduDateKey, kathmanduDayStart, kathmanduNextDayStart } from "./activity-time";

describe("activity time helpers", () => {
  it("keys dates by the Kathmandu calendar day, not UTC", () => {
    // 18:20 UTC is 00:05 the next day in Kathmandu (UTC+05:45).
    expect(kathmanduDateKey(new Date("2026-10-03T18:20:00Z"))).toBe("2026-10-04");
    expect(kathmanduDateKey(new Date("2026-10-03T18:10:00Z"))).toBe("2026-10-03");
  });

  it("formats a time of day in Kathmandu", () => {
    expect(formatKathmanduTime(new Date("2026-10-04T09:20:00Z"))).toMatch(/^3:05\sPM$/);
  });

  it("returns Kathmandu day bounds as UTC instants", () => {
    expect(kathmanduDayStart("2026-10-04").toISOString()).toBe("2026-10-03T18:15:00.000Z");
    expect(kathmanduNextDayStart("2026-10-04").toISOString()).toBe("2026-10-04T18:15:00.000Z");
  });
});
