import { describe, expect, it } from "vitest";

import { expenses, households } from "@/db/schema";

import { rawEqual, reviveRow, toSnapshot } from "./snapshot";

describe("toSnapshot", () => {
  it("stores what jsonb gives back: Dates become ISO strings, undefined keys drop", () => {
    expect(toSnapshot({ a: undefined, createdAt: new Date("2026-10-04T09:20:00.123Z"), n: "1200.00" })).toEqual({
      createdAt: "2026-10-04T09:20:00.123Z",
      n: "1200.00",
    });
  });
});

describe("rawEqual", () => {
  it("treats null and undefined as equal and compares by JSON value", () => {
    expect(rawEqual(null, undefined)).toBe(true);
    expect(rawEqual("1200.00", "1200.00")).toBe(true);
    expect(rawEqual("1200.00", "1200")).toBe(false);
    expect(rawEqual(false, null)).toBe(false);
  });
});

describe("reviveRow", () => {
  it("turns timestamp columns back into Dates and drops non-columns", () => {
    const row = reviveRow(expenses, { amount: "5.00", bogus: 1, createdAt: "2026-10-04T09:20:00.123Z", date: "2026-10-04" });
    expect(row).toEqual({ amount: "5.00", createdAt: new Date("2026-10-04T09:20:00.123Z"), date: "2026-10-04" });
  });

  it("leaves non-timestamp columns alone", () => {
    expect(reviveRow(households, { dateFormat: "english", name: "Home" })).toEqual({ dateFormat: "english", name: "Home" });
  });
});
