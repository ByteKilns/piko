import { describe, expect, it } from "vitest";

import { adAddDays, adAddMonths, adDateInRange, adDayDiff } from "./ad-date";

describe("adAddDays", () => {
  it("crosses a month boundary", () => {
    expect(adAddDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("crosses a year boundary", () => {
    expect(adAddDays("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("handles negative deltas", () => {
    expect(adAddDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("adAddMonths", () => {
  it("advances by whole months", () => {
    expect(adAddMonths("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("crosses a year boundary", () => {
    expect(adAddMonths("2025-12-15", 1)).toBe("2026-01-15");
  });
});

describe("adDayDiff", () => {
  it("counts whole days between dates", () => {
    expect(adDayDiff("2026-01-01", "2026-01-08")).toBe(7);
    expect(adDayDiff("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("adDateInRange", () => {
  it("is inclusive on both ends", () => {
    expect(adDateInRange("2026-01-01", "2026-01-01", "2026-01-31")).toBe(true);
    expect(adDateInRange("2026-01-31", "2026-01-01", "2026-01-31")).toBe(true);
    expect(adDateInRange("2026-02-01", "2026-01-01", "2026-01-31")).toBe(false);
  });
});
