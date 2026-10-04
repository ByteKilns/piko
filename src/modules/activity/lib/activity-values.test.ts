import { describe, expect, it } from "vitest";

import { testFormatters } from "./test-formatters";

const f = testFormatters();

describe("activityFormatters", () => {
  it("formats money from numbers and numeric strings", () => {
    expect(f.money(1200)).toBe("RS 1,200");
    expect(f.money("1200.00")).toBe("RS 1,200");
    expect(f.money(null)).toBeNull();
  });

  it("resolves owners, members and categories to names", () => {
    expect(f.owner(null)).toBe("Shared");
    expect(f.owner("m-1")).toBe("Asha");
    expect(f.owner("gone")).toBe("Former member");
    expect(f.member("m-2")).toBe("Ravi");
    expect(f.member(null)).toBeNull();
    expect(f.category("cat-2")).toBe("Dining");
    expect(f.category("gone")).toBe("Unknown category");
  });

  it("formats dates and periods in the household calendar", () => {
    expect(f.date("2026-08-15")).toBe("15 August 2026");
    expect(f.date(null)).toBeNull();
    expect(f.period(2026, 8)).toBe("August 2026");
  });

  it("trims text and collapses blanks to null", () => {
    expect(f.text("  rent ")).toBe("rent");
    expect(f.text("")).toBeNull();
    expect(f.text(undefined)).toBeNull();
  });
});
